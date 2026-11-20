import { Hono } from "hono";
import { requireAuth } from "./auth.js";
import { getPrisma } from "../lib/prisma.js";
import { decryptFacebookToken, encryptFacebookToken } from "../lib/facebook.js";

const users = new Hono();

users.get("/pages", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const user = await getPrisma(c.env).user.findUnique({
      where: { id: userId },
      include: { facebookPages: true },
    });

    const rawPages = Array.isArray(user?.facebookPages) ? user.facebookPages : [];
    if (!user || (!user.facebookAccessToken && rawPages.length === 0 && !user.facebookId)) {
      return c.json({ success: true, accounts: [], user: null });
    }

    const pages = [...rawPages];
    // If the user's personal profile is not in the pages list, include it so the user can post to both personal profile and pages
    if (user.facebookId && !pages.some((p) => String(p.id) === String(user.facebookId))) {
      const profileName = `${user.facebookName || "Facebook User"} (គណនីផ្ទាល់ខ្លួន)`;
      const profilePic = `https://graph.facebook.com/${user.facebookId}/picture?type=large`;
      const profileDest = {
        id: String(user.facebookId),
        userId: String(userId),
        name: profileName,
        picture: profilePic,
        category: "គណនីផ្ទាល់ខ្លួន",
        isSelected: false,
        enableBot: false,
        enableSchedule: true,
        enableInbox: false
      };
      try {
        await getPrisma(c.env).facebookPage.upsert({
          where: { id: String(user.facebookId) },
          update: {
            userId: String(userId),
            name: profileName,
            picture: profilePic,
            category: "គណនីផ្ទាល់ខ្លួន",
            isConnected: true
          },
          create: {
            id: String(user.facebookId),
            userId: String(userId),
            name: profileName,
            picture: profilePic,
            category: "គណនីផ្ទាល់ខ្លួន",
            accessToken: user.facebookAccessToken || "active_extension_session",
            isConnected: true,
            isSelected: false,
            enableSchedule: true,
            enableBot: false,
            enableInbox: false
          }
        });
      } catch (err) {
        console.warn("Could not upsert profile destination to facebookPage:", err);
      }
      pages.unshift(profileDest);
    }

    const pageSettings = parsePageSettings(user.pageSettings);
    const accounts = await Promise.all(pages.map(async (page) => {
      const savedSettings = pageSettings.find((settings) => settings.pageId === page.id) ?? {};
      let hasAccessToken = false;
      if (typeof page.accessToken === "string" && page.accessToken) {
        try {
          const decrypted = await decryptFacebookToken(page.accessToken, c.env);
          hasAccessToken = isFbToken(decrypted);
        } catch {
          hasAccessToken = isFbToken(page.accessToken);
        }
      }
      const isProfile = page.category === "គណនីផ្ទាល់ខ្លួន" || String(page.id) === String(user.facebookId);
      return {
        id: page.id,
        name: page.name,
        picture: page.picture,
        category: page.category || "Facebook Page",
        isProfile,
        isSelected: isProfile ? page.isSelected === true : page.isSelected !== false,
        hasAccessToken,
        settings: {
          enableBot:
            typeof page.enableBot === "boolean"
              ? page.enableBot
              : Boolean(savedSettings.enableBot),
          enableSchedule:
            typeof page.enableSchedule === "boolean"
              ? page.enableSchedule
              : savedSettings.enableSchedule !== false,
          enableInbox:
            typeof page.enableInbox === "boolean"
              ? page.enableInbox
              : Boolean(savedSettings.enableInbox),
        },
      };
    }));

    return c.json({
      success: true,
      accounts,
      user: user.facebookId ? { id: user.facebookId, name: user.facebookName } : null
    });
  } catch (error) {
    const diagnosticId = c.req.header("cf-ray");
    const errorCode = typeof error?.code === "string" ? error.code : "UNKNOWN";
    console.error("Hono user pages fetch failed:", { diagnosticId, errorCode, error });
    return c.json({ success: false, error: "Failed to fetch pages", diagnosticId, errorCode }, 500);
  }
});

users.post("/pages/toggle", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  if (typeof body?.pageId !== "string" || !body.pageId || typeof body.isSelected !== "boolean") {
    return c.json({ success: false, error: "Page ID and selection state are required" }, 400);
  }

  try {
    const result = await getPrisma(c.env).facebookPage.updateMany({
      where: { id: body.pageId, userId: c.get("authUser").id },
      data: { isSelected: body.isSelected },
    });
    if (result.count === 0) {
      return c.json({ success: false, error: "Page not found" }, 404);
    }

    return c.json({
      success: true,
      message: body.isSelected ? "Page Enabled" : "Page Disabled",
    });
  } catch (error) {
    console.error("Hono page selection update failed:", error);
    return c.json({ success: false, error: "Failed to update page selection" }, 500);
  }
});

users.post("/pages/settings", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  if (typeof body?.pageId !== "string" || !body.pageId ||
      !body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
    return c.json({ success: false, error: "Page ID and settings are required" }, 400);
  }
  const allowedSettings = ["enableBot", "enableSchedule", "enableInbox"];
  if (Object.entries(body.settings).some(
    ([key, value]) => !allowedSettings.includes(key) || typeof value !== "boolean"
  )) {
    return c.json({ success: false, error: "Page settings must be supported boolean values" }, 400);
  }

  const userId = c.get("authUser").id;
  try {
    const prisma = getPrisma(c.env);
    const page = await prisma.facebookPage.findFirst({
      where: { id: body.pageId, userId },
      select: { id: true },
    });
    if (!page) {
      return c.json({ success: false, error: "Page not found" }, 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pageSettings: true },
    });
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const allSettings = parsePageSettings(user.pageSettings);
    const existingSetting = allSettings.find((settings) => settings.pageId === body.pageId) ?? {};
    const pageSettings = allSettings.filter((settings) => settings.pageId !== body.pageId);
    pageSettings.push({ ...existingSetting, pageId: body.pageId, ...body.settings });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { pageSettings },
      }),
      prisma.facebookPage.updateMany({
        where: { id: body.pageId, userId },
        data: { ...body.settings },
      }),
    ]);

    return c.json({ success: true, message: "Settings updated" });
  } catch (error) {
    console.error("Hono page settings update failed:", error);
    return c.json({ success: false, error: "Failed to update settings" }, 500);
  }
});

function isFbToken(str) {
  if (!str || typeof str !== "string") return false;
  return /^EAA[A-Za-z0-9_-]{30,}$/.test(str.trim());
}

users.post("/pages/connect-cookie", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ (Invalid JSON)" }, 400);
  }

  const userId = c.get("authUser").id;
  const rawInput = String(body?.cookieOrToken || body?.accessToken || "").trim();
  const extAccessToken = typeof body?.accessToken === "string" && isFbToken(body.accessToken) ? body.accessToken.trim() : null;
  const extPages = Array.isArray(body?.pages) ? body.pages : null;
  const extUser = body?.fbUser && typeof body.fbUser === "object" ? body.fbUser : null;

  if (!rawInput && !extAccessToken && (!extPages || extPages.length === 0)) {
    return c.json({
      success: false,
      error: "សូមភ្ជាប់តាមរយៈ EZA-POST FB Extension (មិនឃើញសម័យ Facebook ទេ)",
    }, 400);
  }

  try {
    let userToken = extAccessToken || (isFbToken(rawInput) ? rawInput : null);
    let fbUser = extUser;
    let rawPages = extPages || [];

    const resolvedFbUserId = extUser?.id || body?.fbUserId || null;

    // Anti-ban protection: NEVER replay c_user/xs cookies from Cloudflare datacenter IPs to scrape facebook.com.
    // All session extraction runs strictly inside the user's residential Chrome Extension.
    if (!fbUser && resolvedFbUserId) {
      fbUser = {
        id: String(resolvedFbUserId),
        name: "Facebook User",
        picture: `https://graph.facebook.com/${resolvedFbUserId}/picture?type=large`,
      };
    }

    // If we have an EAA token, fetch profile and pages via official Graph API only (no datacenter cookie scraping)
    let isDirectPageToken = false;
    let tokenPermissions = [];
    let hasPublishPermissions = false;

    if (userToken) {
      const meRes = await fetch(
        `https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(userToken)}&fields=id,name,category,picture{url}`
      );
      const meData = await meRes.json().catch(() => ({}));
      if (meRes.ok && meData?.id) {
        isDirectPageToken = Boolean(meData.category);
        if (isDirectPageToken) {
          hasPublishPermissions = true;
          rawPages = [
            {
              id: String(meData.id),
              name: String(meData.name || "Facebook Page"),
              category: meData.category || "Facebook Page",
              picture: meData.picture,
              access_token: userToken,
            },
          ];
          if (!fbUser || !fbUser.id) {
            fbUser = {
              id: String(meData.id),
              name: String(meData.name || "Facebook Page"),
              picture: meData.picture?.data?.url || `https://graph.facebook.com/${meData.id}/picture?type=large`,
            };
          }
        } else {
          fbUser = {
            id: String(meData.id),
            name: String(meData.name || "Facebook User"),
            picture: meData.picture?.data?.url || `https://graph.facebook.com/${meData.id}/picture?type=large`,
          };
        }
      } else if (!extPages?.length && isFbToken(rawInput)) {
        return c.json({
          success: false,
          error: meData?.error?.message || "Facebook Access Token មិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ!",
        }, 400);
      }

      if (!isDirectPageToken) {
        const permRes = await fetch(
          `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(userToken)}`
        ).catch(() => null);
        const permData = permRes ? await permRes.json().catch(() => ({})) : {};
        if (Array.isArray(permData?.data)) {
          tokenPermissions = permData.data
            .filter((p) => p?.status === "granted" && p?.permission)
            .map((p) => p.permission);
          hasPublishPermissions =
            tokenPermissions.includes("pages_manage_posts") || tokenPermissions.includes("publish_video");
        }

        const pagesUrl = new URL("https://graph.facebook.com/v21.0/me/accounts");
        pagesUrl.searchParams.set("access_token", userToken);
        pagesUrl.searchParams.set("fields", "id,name,access_token,category,picture{url}");
        pagesUrl.searchParams.set("limit", "100");
        const pagesRes = await fetch(pagesUrl);
        const pagesData = await pagesRes.json().catch(() => ({}));
        if (pagesRes.ok && Array.isArray(pagesData?.data)) {
          rawPages = pagesData.data;
        }
      }
    }

    if (!fbUser || !fbUser.id) {
      return c.json({
        success: false,
        error: "មិនអាចទាញយកទិន្នន័យពីគណនី Facebook បានទេ។ សូមប្រាកដថាអ្នកបាន Login Facebook លើ Browser រួចសាកល្បងម្តងទៀត!",
      }, 400);
    }

    const prisma = getPrisma(c.env);

    // Prevent UNIQUE constraint conflict on users.facebookId
    if (!isDirectPageToken && c.env.DB) {
      await c.env.DB.prepare("UPDATE users SET facebookId = NULL WHERE facebookId = ? AND id != ?")
        .bind(String(fbUser.id), String(userId))
        .run()
        .catch(() => {});
    }

    const encryptedUserToken = await encryptFacebookToken(userToken || "active_extension_session", c.env);

    if (!isDirectPageToken) {
      await prisma.user.update({
        where: { id: String(userId) },
        data: {
          facebookId: String(fbUser.id),
          facebookName: String(fbUser.name || "Facebook User"),
          facebookAccessToken: encryptedUserToken,
        },
      });
    }

    const destinationsToSave = [];

    // 1. Include User's Personal Profile / Account when syncing a User session
    if (!isDirectPageToken && fbUser && fbUser.id) {
      destinationsToSave.push({
        id: String(fbUser.id),
        name: `${fbUser.name} (គណនីផ្ទាល់ខ្លួន)`,
        picture: fbUser.picture || `https://graph.facebook.com/${fbUser.id}/picture?type=large`,
        category: "គណនីផ្ទាល់ខ្លួន",
        access_token: userToken || "active_extension_session"
      });
    }

    // 2. Add all Facebook Pages
    for (const p of rawPages) {
      if (p && p.id && (isDirectPageToken || String(p.id) !== String(fbUser?.id))) {
        destinationsToSave.push({
          id: String(p.id),
          name: String(p.name),
          picture:
            p.picture?.data?.url ||
            (typeof p.picture === "string" ? p.picture : null) ||
            `https://graph.facebook.com/${p.id}/picture?type=large`,
          category: p.category || "Facebook Page",
          access_token: p.access_token || p.accessToken || userToken || "active_extension_session"
        });
      }
    }

    const savedPages = [];
    for (const p of destinationsToSave) {
      if (!p || !p.id || !p.name) continue;
      try {
        const isProfile = p.category === "គណនីផ្ទាល់ខ្លួន";
        const rawPageToken = p.access_token || userToken || "active_extension_session";
        const encryptedPageToken = await encryptFacebookToken(rawPageToken, c.env);
        const pictureUrl = p.picture || `https://graph.facebook.com/${p.id}/picture?type=large`;
        const category = p.category || "Facebook Page";

        const saved = await prisma.facebookPage.upsert({
          where: { id: String(p.id) },
          update: {
            userId: String(userId),
            name: String(p.name),
            accessToken: encryptedPageToken,
            picture: pictureUrl,
            category: category,
            isConnected: true,
            isSelected: !isProfile,
            enableSchedule: true,
          },
          create: {
            id: String(p.id),
            userId: String(userId),
            name: String(p.name),
            accessToken: encryptedPageToken,
            picture: pictureUrl,
            category: category,
            isConnected: true,
            isSelected: !isProfile,
          },
        });

        savedPages.push({
          id: saved.id,
          name: saved.name,
          picture: saved.picture,
          category: saved.category,
          isProfile,
          isSelected: !isProfile,
          hasAccessToken: isFbToken(rawPageToken),
        });
      } catch (pageErr) {
        console.warn("Failed to upsert Facebook page/profile:", p.id, pageErr);
      }
    }

    const hasPublishToken = Boolean(userToken || savedPages.some((p) => !p.isProfile && p.hasAccessToken));

    return c.json({
      success: true,
      user: fbUser,
      hasPublishToken,
      hasPublishPermissions,
      grantedPermissions: tokenPermissions,
      pagesCount: savedPages.length,
      pages: savedPages,
      message:
        savedPages.length > 0
          ? !hasPublishToken
            ? `បានទាញបញ្ជីផេកចំនួន ${savedPages.length} ប៉ុន្តែមិនទាន់រកឃើញ Facebook Access Token (EAA...) ទេ — សូមទាញយក Extension ថ្មី ហើយ Sync ឡើងវិញ!`
            : !hasPublishPermissions
            ? `បានភ្ជាប់ផេកចំនួន ${savedPages.length} (សូមសាកល្បងផុស ឬផ្ទុក Extension ថ្មីឡើងវិញបើជួបកំហុសផុសវីដេអូ)`
            : `បានភ្ជាប់ផេកចំនួន ${savedPages.length} ដោយជោគជ័យ!`
          : "បានភ្ជាប់គណនី Facebook រួចរាល់ ប៉ុន្តែរកមិនឃើញផេកនៅក្នុងគណនីនេះទេ។",
    });
  } catch (error) {
    console.error("Hono connect-cookie failed:", error);
    return c.json({
      success: false,
      error: error?.message || "មិនអាចភ្ជាប់ផេក Facebook បានទេ សូមព្យាយាមម្តងទៀត",
    }, 400);
  }
});

users.put("/update", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  const userId = c.get("authUser").id;
  const { name, email, avatar, coverImage } = body ?? {};
  if (name !== undefined && name !== null && typeof name !== "string") {
    return c.json({ error: "Name must be a string." }, 400);
  }
  if (email !== undefined && email !== null && typeof email !== "string") {
    return c.json({ error: "Email must be a string." }, 400);
  }
  if (avatar !== undefined && avatar !== null && typeof avatar !== "string") {
    return c.json({ error: "Avatar must be a string." }, 400);
  }
  if (coverImage !== undefined && coverImage !== null && typeof coverImage !== "string") {
    return c.json({ error: "Cover image must be a string." }, 400);
  }

  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
  if (name && normalizedName.length < 2) {
    return c.json({ error: "Name must be at least 2 characters long." }, 400);
  }
  if (!normalizedName && !normalizedEmail && !avatar && !coverImage) {
    return c.json({ error: "No changes provided." }, 400);
  }

  const data = {};
  if (normalizedName) data.name = normalizedName;
  if (normalizedEmail) data.email = normalizedEmail;
  if (avatar) data.avatar = avatar;
  if (coverImage) data.coverImage = coverImage;

  try {
    const prisma = getPrisma(c.env);
    if (normalizedEmail) {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existingUser && existingUser.id !== userId) {
        return c.json({ error: "Email is already in use by another account." }, 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        coverImage: true,
        role: true,
      },
    });

    return c.json({
      success: true,
      message: "Profile updated successfully!",
      user: { ...updatedUser, isDemo: false },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return c.json({ error: "Email is already in use by another account." }, 400);
    }
    console.error("Hono profile update failed:", error);
    return c.json({ error: "Failed to update profile." }, 500);
  }
});

users.get("/stats", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const prisma = getPrisma(c.env);
    const [posts, replies] = await Promise.all([
      prisma.scheduledPost.count({ where: { userId } }),
      prisma.repliedComment.count({ where: { userId } }),
    ]);

    return c.json({ success: true, stats: { posts, replies } });
  } catch (error) {
    console.error("Hono user stats fetch failed:", error);
    return c.json({ success: false, error: "Failed to fetch stats" }, 500);
  }
});

users.get("/connections", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const prisma = getPrisma(c.env);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { facebookPages: true },
    });

    let configs = [];
    try {
      configs = await prisma.platformConfig.findMany({
        where: { userId },
        select: { platform: true, isEnabled: true },
      });
    } catch (cfgErr) {
      console.warn("Failed to query platformConfig, using empty defaults:", cfgErr);
    }

    const hasFacebook = Boolean(
      user?.facebookAccessToken ||
      (Array.isArray(user?.facebookPages) && user.facebookPages.length > 0)
    );

    const connections = {
      youtube: false,
      tiktok: false,
      instagram: false,
      facebook: hasFacebook,
    };

    if (Array.isArray(configs)) {
      for (const config of configs) {
        if (config?.isEnabled && Object.hasOwn(connections, config.platform)) {
          connections[config.platform] = true;
        }
      }
    }

    return c.json({ success: true, connections });
  } catch (error) {
    const diagnosticId = c.req.header("cf-ray");
    const errorCode = typeof error?.code === "string" ? error.code : "UNKNOWN";
    console.error("Hono user connections fetch failed:", { diagnosticId, errorCode, error });
    return c.json({ success: false, error: "Server Error", diagnosticId, errorCode }, 500);
  }
});

function parsePageSettings(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (error) {
      console.warn("Ignoring malformed saved page settings:", error);
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((setting) => setting && typeof setting === "object") : [];
}

export default users;
