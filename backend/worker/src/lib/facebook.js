const graphApiVersion = "v21.0";

export async function exchangeFacebookCode(code, env) {
  const appId = requiredEnv(env, "FB_APP_ID");
  const appSecret = requiredEnv(env, "FB_APP_SECRET");
  const redirectUri = requiredEnv(env, "FACEBOOK_REDIRECT_URI");
  const shortLived = await graphRequest(
    "oauth/access_token",
    {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    }
  );
  if (typeof shortLived.access_token !== "string") {
    throw new Error("Facebook did not return an access token.");
  }

  const longLived = await graphRequest("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLived.access_token,
  });
  if (typeof longLived.access_token !== "string") {
    throw new Error("Facebook did not return a long-lived access token.");
  }

  return {
    accessToken: longLived.access_token,
    expiresAt: new Date(Date.now() + (longLived.expires_in || 5_184_000) * 1000),
  };
}

export async function fetchFacebookProfile(accessToken) {
  const result = await graphRequest("me", {
    access_token: accessToken,
    fields: "id,name,email",
  });
  if (typeof result.id !== "string" || typeof result.name !== "string") {
    throw new Error("Facebook returned an invalid profile.");
  }
  return result;
}

export async function fetchFacebookPages(accessToken) {
  const result = await graphRequest("me/accounts", {
    access_token: accessToken,
    fields: "id,name,access_token,picture{url},category",
    limit: "100",
  });
  if (!Array.isArray(result.data)) {
    throw new Error("Facebook returned an invalid pages list.");
  }

  return result.data.map((page) => {
    if (typeof page.id !== "string" || typeof page.name !== "string" ||
        typeof page.access_token !== "string") {
      throw new Error("Facebook returned a page with missing required data.");
    }
    return {
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      picture: typeof page.picture?.data?.url === "string" ? page.picture.data.url : null,
      category: typeof page.category === "string" ? page.category : null,
    };
  });
}

export async function publishFacebookPost(pageId, pageToken, post, page = {}) {
  const graphUrl = `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(pageId)}`;
  const mediaUrls = Array.isArray(post.mediaFiles)
    ? post.mediaFiles.filter((url) => typeof url === "string" && url)
    : [];
  const videoUrl = post.videoUrl || mediaUrls[0];
  if (post.postType === "carousel" && Array.isArray(post.carouselCards) &&
      post.carouselCards.length) {
    const childAttachments = [];
    for (const card of post.carouselCards) {
      let mediaId;
      if (card.type === "video") {
        assertCloudinaryMediaUrl(card.mediaUrl, "video");
        const uploaded = await graphPost(`${graphUrl}/videos`, {
          access_token: pageToken,
          file_url: card.mediaUrl,
          description: card.description || "",
          published: "false",
        });
        mediaId = uploaded.id;
      } else if (card.type === "image") {
        const pictureUrl = card.isPageCard ? page.picture : card.mediaUrl;
        assertAllowedCarouselImageUrl(pictureUrl, card.isPageCard === true);
        const uploaded = await graphPost(`${graphUrl}/photos`, {
          access_token: pageToken,
          url: pictureUrl,
          published: "false",
        });
        mediaId = uploaded.id;
      } else {
        throw new Error("Carousel card has an unsupported media type.");
      }
      const link = safeCarouselLink(card.link) || `https://facebook.com/${pageId}`;
      const attachment = {
        media_fbid: mediaId,
        link,
        name: card.headline || page.name || "Facebook Page",
        description: card.description || "",
      };
      if (card.cta && card.cta !== "NO_BUTTON") {
        attachment.call_to_action = { type: card.cta, value: { link } };
      }
      childAttachments.push(attachment);
    }

    const result = await graphPost(`${graphUrl}/feed`, {
      access_token: pageToken,
      message: post.caption || "",
      child_attachments: JSON.stringify(childAttachments),
      link: `https://facebook.com/${pageId}`,
    });
    return result.id;
  }

  if (!mediaUrls.length && !videoUrl) {
    const result = await graphPost(`${graphUrl}/feed`, {
      access_token: pageToken,
      message: post.caption || "",
    });
    return result.id;
  }

  if (post.postType === "video") {
    assertCloudinaryMediaUrl(videoUrl, "video");
    const result = await graphPost(`${graphUrl}/videos`, {
      access_token: pageToken,
      file_url: videoUrl,
      description: post.caption || "",
    });
    return result.id;
  }

  if (post.postType === "image") {
    if (mediaUrls.length !== 1) throw new Error("Image posts require exactly one image.");
    assertCloudinaryMediaUrl(mediaUrls[0], "image");
    const result = await graphPost(`${graphUrl}/photos`, {
      access_token: pageToken,
      url: mediaUrls[0],
      caption: post.caption || "",
    });
    return result.post_id || result.id;
  }

  if (post.postType === "carousel") {
    if (mediaUrls.length < 2 || mediaUrls.length > 10) {
      throw new Error("Photo carousels require between 2 and 10 images.");
    }
    for (const mediaUrl of mediaUrls) assertCloudinaryMediaUrl(mediaUrl, "image");
    const attachments = [];
    for (const mediaUrl of mediaUrls) {
      const photo = await graphPost(`${graphUrl}/photos`, {
        access_token: pageToken,
        url: mediaUrl,
        published: "false",
      });
      attachments.push(JSON.stringify({ media_fbid: photo.id }));
    }
    const params = new URLSearchParams({
      access_token: pageToken,
      message: post.caption || "",
    });
    attachments.forEach((attachment, index) => {
      params.append(`attached_media[${index}]`, attachment);
    });
    const result = await graphPost(`${graphUrl}/feed`, params);
    return result.id;
  }

  throw new Error("Unsupported Facebook post type.");
}

export async function encryptFacebookToken(token, env) {
  const key = await getLegacyFacebookEncryptionKey(env, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      key,
      new TextEncoder().encode(token)
    )
  );

  return `${bytesToHex(iv)}:${bytesToHex(ciphertext)}`;
}

export async function decryptFacebookToken(token, env) {
  if (typeof token !== "string" || !token.includes(":")) return token;
  const [ivHex, ciphertextHex, ...remaining] = token.split(":");
  if (remaining.length || !/^(?:[0-9a-f]{2}){16}$/i.test(ivHex) ||
      !ciphertextHex || !/^(?:[0-9a-f]{2})+$/i.test(ciphertextHex)) {
    throw new Error("Encrypted Facebook token has an invalid format.");
  }

  const key = await getLegacyFacebookEncryptionKey(env, ["decrypt"]);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: hexToBytes(ivHex) },
      key,
      hexToBytes(ciphertextHex)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error("Unable to decrypt Facebook access token.");
  }
}

export async function fetchRecentFacebookPosts(pageId, accessToken) {
  const baseParams = {
    access_token: accessToken,
    limit: "30",
  };
  let result;
  try {
    result = await graphRequest(`${pageId}/feed`, {
      ...baseParams,
      fields: "id,message,created_time,full_picture,permalink_url,insights.metric(post_impressions_unique,post_video_views,post_reactions_by_type_total,post_comments_engagement)",
    });
  } catch (error) {
    console.warn("Facebook post insights fetch failed; retrying without insights:", error);
    result = await graphRequest(`${pageId}/feed`, {
      ...baseParams,
      fields: "id,message,created_time,full_picture,permalink_url",
    });
  }

  if (!Array.isArray(result.data)) {
    throw new Error("Facebook returned an invalid posts list.");
  }
  const posts = result.data.map((post) => {
    const insights = Array.isArray(post.insights?.data) ? post.insights.data : [];
    const reach = insights.find((insight) => insight.name === "post_impressions_unique")
      ?.values?.[0]?.value || 0;
    const views = insights.find((insight) => insight.name === "post_video_views")
      ?.values?.[0]?.value || 0;
    return { ...post, reach, views };
  });
  posts.sort((first, second) => (second.views + second.reach) - (first.views + first.reach));
  return posts;
}

async function graphRequest(path, params) {
  const url = new URL(`https://graph.facebook.com/${graphApiVersion}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url);
  let result;
  try {
    result = await response.json();
  } catch (error) {
    console.error("Facebook Graph API returned invalid JSON:", error);
    throw new Error("Facebook returned an invalid response.");
  }
  if (!response.ok || result?.error) {
    console.error("Facebook Graph API request failed:", {
      status: response.status,
      code: result?.error?.code,
    });
    throw new Error("Facebook request failed.");
  }
  return result;
}

function assertAllowedCarouselImageUrl(value, isPagePicture) {
  if (!isPagePicture) {
    assertCloudinaryMediaUrl(value, "image");
    return;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Facebook Page picture URL is invalid.");
  }
  if (url.protocol !== "https:" ||
      !(url.hostname === "graph.facebook.com" || url.hostname.endsWith(".fbcdn.net"))) {
    throw new Error("Facebook Page picture URL is not trusted.");
  }
}

function safeCarouselLink(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function graphPost(url, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params instanceof URLSearchParams ? params : new URLSearchParams(params),
  });
  let result;
  try {
    result = await response.json();
  } catch (error) {
    console.error("Facebook Graph API returned invalid JSON:", error);
    throw new Error("Facebook returned an invalid response.");
  }
  if (!response.ok || result?.error || typeof result.id !== "string" &&
      typeof result.post_id !== "string") {
    console.error("Facebook publish request failed:", {
      status: response.status,
      code: result?.error?.code,
    });
    throw new Error(result?.error?.message || "Facebook post failed.");
  }
  return result;
}

function assertCloudinaryMediaUrl(value, resourceType) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Post media URL is invalid.");
  }
  if (url.protocol !== "https:" ||
      !(url.hostname === "res.cloudinary.com" || url.hostname.endsWith(".cloudinary.com")) ||
      !url.pathname.includes(`/${resourceType}/upload/`)) {
    throw new Error("Post media must be hosted on Cloudinary with the expected media type.");
  }
}

function requiredEnv(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value) {
    throw new Error(`${name} Worker secret is not configured.`);
  }
  return value;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function getLegacyFacebookEncryptionKey(env, usages) {
  const passphrase =
    env.ENCRYPTION_KEY || env.JWT_SECRET || "default_secret_key_must_be_32_bytes_long";
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(passphrase)))
  );
  const encodedDigest = bytesToBase64(digest).slice(0, 32);
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(encodedDigest),
    { name: "AES-CBC" },
    false,
    usages
  );
}

function hexToBytes(value) {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
