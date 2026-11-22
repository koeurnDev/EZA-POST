const graphApiVersion = "v21.0";
const paceDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const META_ADS_SETTINGS_KEY = "__meta_ads__";
const AD_CREATIVE_FORMATS = new Set([
  "video_cta",
  "photo_cta",
  "video_pe",
  "photo_pe",
  "instant_experience",
]);

function isFbToken(str) {
  return typeof str === "string" && /^EAA[A-Za-z0-9_-]{30,}$/.test(str.trim());
}

export async function resolveMetaAdsFromSettings(pageSettings, env) {
  let list = pageSettings;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  const entry = Array.isArray(list)
    ? list.find((s) => s && s.pageId === META_ADS_SETTINGS_KEY)
    : null;
  let adsToken = null;
  if (entry?.adsAccessToken) {
    try {
      const dec = await decryptFacebookToken(entry.adsAccessToken, env);
      if (isFbToken(dec)) adsToken = dec.trim();
    } catch {
      if (isFbToken(entry.adsAccessToken)) adsToken = entry.adsAccessToken.trim();
    }
  }
  return {
    adsToken,
    adAccounts: Array.isArray(entry?.adAccounts) ? entry.adAccounts : [],
  };
}

export async function createFacebookLiveStream(pageId, pageToken, { title = "Facebook Live Stream", description = "" } = {}) {
  if (!isFbToken(pageToken)) {
    throw new Error("ផេកនេះមិនទាន់មាន Access Token ត្រឹមត្រូវសម្រាប់បង្កើត Live Stream ទេ។");
  }
  const res = await graphPost(`https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(pageId)}/live_videos`, {
    access_token: pageToken,
    status: "LIVE_NOW",
    title,
    description,
  });
  return {
    id: String(res.id),
    streamUrl: res.secure_stream_url || res.stream_url || "",
    dashIngestUrl: res.dash_ingest_url || "",
  };
}

function isFacebookHardStopError(fbErrOrMsg) {
  if (!fbErrOrMsg) return false;
  if (typeof fbErrOrMsg === "object" && !(fbErrOrMsg instanceof Error)) {
    const code = Number(fbErrOrMsg.code);
    if ([1, 4, 10, 17, 32, 190, 200, 368, 459].includes(code)) {
      return true;
    }
    if (code === 100) return false;
    return isFacebookHardStopError(fbErrOrMsg.message || "");
  }
  const msg = fbErrOrMsg instanceof Error ? fbErrOrMsg.message : String(fbErrOrMsg);
  return /FB #(1|4|10|17|32|190|200|368|459)\b|Error validating access token|session has been invalidated|checkpoint|temporarily blocked|action blocked|spam/i.test(
    msg
  );
}

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

export async function publishFacebookPost(pageId, pageToken, post, page = {}, env = null) {
  if (
    typeof pageToken !== "string" ||
    !pageToken.trim() ||
    pageToken === "active_extension_session" ||
    /c_user=|xs=|;\s*[a-z_]+=/i.test(pageToken)
  ) {
    throw new Error(
      "ផេកនេះមិនទាន់មាន Facebook Access Token (EAA...) ត្រឹមត្រូវសម្រាប់បង្ហោះទេ។ សូម Sync ឡើងវិញតាម Extension ឬភ្ជាប់តាម Facebook Login។"
    );
  }
  const graphUrl = `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(pageId)}`;
  const graphVideoUrl = `https://graph-video.facebook.com/${graphApiVersion}/${encodeURIComponent(pageId)}`;
  const mediaUrls = Array.isArray(post.mediaFiles)
    ? post.mediaFiles.filter((url) => typeof url === "string" && url)
    : [];
  const videoUrl = post.videoUrl || mediaUrls[0];
  const rawCards = Array.isArray(post.carouselCards) ? post.carouselCards : [];
  const metaCfg = rawCards.find((card) => card && card.isMetaConfig === true) || {};
  const realCards = rawCards.filter((card) => card && !card.isMetaConfig);

  if (AD_CREATIVE_FORMATS.has(metaCfg.format)) {
    return publishAdCreativePost(pageId, pageToken, post, metaCfg, realCards, page, env);
  }

  if (post.postType === "carousel" && realCards.length > 0) {
    let primaryVideoUrl =
      videoUrl ||
      realCards.find((card) => card?.type === "video" && typeof card?.mediaUrl === "string" && card.mediaUrl)?.mediaUrl ||
      null;

    try {
      const childAttachments = [];
      for (const [cardIdx, card] of realCards.entries()) {
        if (cardIdx > 0) await paceDelay(350);
        let mediaId;
        if (card.type === "video") {
          assertValidMediaUrl(card.mediaUrl, "video");
          primaryVideoUrl = primaryVideoUrl || card.mediaUrl;
          const uploaded = await uploadFacebookMedia(
            `${graphVideoUrl}/videos`,
            `${graphUrl}/videos`,
            card.mediaUrl,
            {
              access_token: pageToken,
              description: card.description || post.caption || "",
              published: "false",
            },
            "file_url",
            env
          );
          mediaId = uploaded.id;
        } else if (card.type === "image") {
          const pictureUrl = card.isPageCard
            ? `https://graph.facebook.com/${encodeURIComponent(pageId)}/picture?type=large`
            : card.mediaUrl;
          assertAllowedCarouselImageUrl(pictureUrl, card.isPageCard === true);
          const uploaded = await uploadFacebookMedia(
            `${graphUrl}/photos`,
            `${graphUrl}/photos`,
            pictureUrl,
            {
              access_token: pageToken,
              published: "false",
            },
            "url",
            env
          );
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
    } catch (carouselErr) {
      if (isFacebookHardStopError(carouselErr)) {
        // Do not hammer Facebook with a second /videos blast if Meta returned a token, permission, spam, or #1 rejection
        throw carouselErr;
      }
      // Graph API v21.0 often rejects unpublished carousel card uploads or organic mixed video/CTA child_attachments on /{pageId}/feed
      if (primaryVideoUrl) {
        console.warn("Carousel upload/feed rejected by Facebook; falling back to single video post:", carouselErr?.message);
        const fallback = await uploadFacebookMedia(
          `${graphVideoUrl}/videos`,
          `${graphUrl}/videos`,
          primaryVideoUrl,
          {
            access_token: pageToken,
            description: post.caption || "",
          },
          "file_url",
          env
        );
        return fallback.id;
      }
      throw carouselErr;
    }
  }

  if (!mediaUrls.length && !videoUrl) {
    const linkUrl = safeCarouselLink(metaCfg.link || post.link);
    const feedParams = {
      access_token: pageToken,
      message: post.caption || "",
    };
    if (linkUrl) feedParams.link = linkUrl;
    const result = await graphPost(`${graphUrl}/feed`, feedParams);
    return result.id;
  }

  if (post.postType === "reels" || metaCfg.format === "reels") {
    assertValidMediaUrl(videoUrl, "video");
    return uploadFacebookReelViaRupload(pageId, pageToken, videoUrl, post.caption || "", env);
  }

  if (post.postType === "video") {
    assertValidMediaUrl(videoUrl, "video");
    const result = await uploadFacebookMedia(
      `${graphVideoUrl}/videos`,
      `${graphUrl}/videos`,
      videoUrl,
      {
        access_token: pageToken,
        description: post.caption || "",
      },
      "file_url",
      env
    );
    return result.id;
  }

  if (post.postType === "image" || (post.postType === "carousel" && realCards.length === 0)) {
    if (mediaUrls.length === 1) {
      assertValidMediaUrl(mediaUrls[0], "image");
      const result = await uploadFacebookMedia(
        `${graphUrl}/photos`,
        `${graphUrl}/photos`,
        mediaUrls[0],
        {
          access_token: pageToken,
          caption: post.caption || "",
        },
        "url",
        env
      );
      return result.post_id || result.id;
    }
    if (mediaUrls.length < 2 || mediaUrls.length > 10) {
      throw new Error("Photo carousels require between 1 and 10 images.");
    }
    for (const mediaUrl of mediaUrls) assertValidMediaUrl(mediaUrl, "image");
    const attachments = [];
    for (const [idx, mediaUrl] of mediaUrls.entries()) {
      if (idx > 0) await paceDelay(350);
      const photo = await uploadFacebookMedia(
        `${graphUrl}/photos`,
        `${graphUrl}/photos`,
        mediaUrl,
        {
          access_token: pageToken,
          published: "false",
        },
        "url",
        env
      );
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

function buildCallToActionSpec(cta, link, pageId) {
  if (!cta || cta === "NO_BUTTON") return undefined;
  if (cta === "SEND_MESSAGE" || cta === "MESSAGE_PAGE") {
    return { type: "MESSAGE_PAGE", value: { app_destination: "MESSENGER" } };
  }
  return {
    type: cta,
    value: { link: safeCarouselLink(link) || `https://facebook.com/${pageId}` },
  };
}

async function uploadAdAccountVideo(actId, adsToken, videoUrl, env) {
  assertValidMediaUrl(videoUrl, "video");
  const endpoint = `https://graph-video.facebook.com/${graphApiVersion}/${encodeURIComponent(actId)}/advideos`;
  const uploaded = await uploadFacebookMedia(endpoint, endpoint, videoUrl, { access_token: adsToken }, "file_url", env);
  return String(uploaded.id);
}

async function uploadAdAccountImage(actId, adsToken, imageUrl, env) {
  if (env?.MEDIA_BUCKET && typeof imageUrl === "string") {
    const key = parseR2MediaKey(imageUrl);
    if (key) {
      const object = await env.MEDIA_BUCKET.get(key);
      if (object) {
        const bytes = await object.arrayBuffer();
        const contentType = object.httpMetadata?.contentType || "image/jpeg";
        const filename = key.split("/").pop() || "image.jpg";
        const form = new FormData();
        form.set("access_token", adsToken);
        form.set("filename", new Blob([bytes], { type: contentType }), filename);
        const res = await fetch(`https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(actId)}/adimages`, {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        const firstImg = data?.images ? Object.values(data.images)[0] : null;
        if (firstImg?.hash) {
          return { hash: firstImg.hash, url: firstImg.url || imageUrl };
        }
      }
    }
  }
  return { hash: null, url: imageUrl };
}

async function publishAdCreativePost(pageId, pageToken, post, metaCfg, realCards, page, env) {
  const adsToken = post._adsContext?.adsToken || pageToken;
  const rawAccountId = metaCfg.adAccountId || post._adsContext?.adAccounts?.[0]?.id;
  if (!rawAccountId || !isFbToken(adsToken)) {
    throw new Error(
      "ទម្រង់ PE / CTA ត្រូវការ Ad Account និង Ads Token (EAAB) — សូមបើក adsmanager.facebook.com លើ Chrome រួចចុច Sync Extension v2.2.0 ឡើងវិញ!"
    );
  }
  const actId = String(rawAccountId).startsWith("act_") ? String(rawAccountId) : `act_${rawAccountId}`;
  const mediaUrls = Array.isArray(post.mediaFiles)
    ? post.mediaFiles.filter((url) => typeof url === "string" && url)
    : [];
  const defaultPageUrl = `https://facebook.com/${pageId}`;
  const baseLink = safeCarouselLink(metaCfg.link) || defaultPageUrl;
  const ctaSpec = buildCallToActionSpec(metaCfg.cta, baseLink, pageId);
  const pageFallbackPic = `https://graph.facebook.com/${encodeURIComponent(pageId)}/picture?type=large`;

  let objectStorySpec;
  if (metaCfg.format === "video_cta") {
    const videoSrc = post.videoUrl || mediaUrls[0];
    if (!videoSrc) throw new Error("Video CTA តម្រូវឱ្យដាក់វីដេអូ។");
    const videoId = await uploadAdAccountVideo(actId, adsToken, videoSrc, env);
    const thumbUrl = post.thumbnailUrl || metaCfg.thumbnailUrl || pageFallbackPic;
    objectStorySpec = {
      page_id: String(pageId),
      video_data: {
        video_id: videoId,
        message: post.caption || "",
        title: metaCfg.headline || page.name || "",
        link_description: metaCfg.description || "",
        image_url: thumbUrl,
        ...(ctaSpec ? { call_to_action: ctaSpec } : {}),
      },
    };
  } else if (metaCfg.format === "photo_cta" || metaCfg.format === "instant_experience") {
    const imageSrc = mediaUrls[0] || post.thumbnailUrl || pageFallbackPic;
    const imgAsset = await uploadAdAccountImage(actId, adsToken, imageSrc, env);
    const canvasLink =
      metaCfg.format === "instant_experience"
        ? safeCarouselLink(metaCfg.canvasUrl) ||
          (metaCfg.canvasId ? `https://fb.com/canvas_doc/${encodeURIComponent(metaCfg.canvasId)}` : baseLink)
        : baseLink;
    const resolvedCta = buildCallToActionSpec(metaCfg.cta || "LEARN_MORE", canvasLink, pageId);
    objectStorySpec = {
      page_id: String(pageId),
      link_data: {
        message: post.caption || "",
        link: canvasLink,
        name: metaCfg.headline || page.name || "Facebook Page",
        description: metaCfg.description || "",
        ...(imgAsset.hash ? { image_hash: imgAsset.hash } : { picture: imgAsset.url }),
        ...(resolvedCta ? { call_to_action: resolvedCta } : {}),
      },
    };
  } else {
    // video_pe or photo_pe (Carousel PE)
    if (realCards.length < 2) {
      throw new Error("Carousel PE តម្រូវឱ្យមានយ៉ាងតិច ២ កាត។");
    }
    const childAttachments = [];
    for (const [idx, card] of realCards.slice(0, 10).entries()) {
      if (idx > 0) await paceDelay(300);
      const cardLink = safeCarouselLink(card.link) || baseLink;
      const cardCta = buildCallToActionSpec(card.cta || metaCfg.cta, cardLink, pageId);
      if (card.type === "video") {
        const videoId = await uploadAdAccountVideo(actId, adsToken, card.mediaUrl, env);
        const thumb = post.thumbnailUrl || metaCfg.thumbnailUrl || pageFallbackPic;
        childAttachments.push({
          video_id: videoId,
          picture: thumb,
          link: cardLink,
          name: card.headline || metaCfg.headline || page.name || "",
          description: card.description || metaCfg.description || "",
          ...(cardCta ? { call_to_action: cardCta } : {}),
        });
      } else {
        const picUrl = card.isPageCard ? pageFallbackPic : card.mediaUrl;
        const imgAsset = card.isPageCard ? { hash: null, url: picUrl } : await uploadAdAccountImage(actId, adsToken, picUrl, env);
        childAttachments.push({
          ...(imgAsset.hash ? { image_hash: imgAsset.hash } : { picture: imgAsset.url }),
          link: cardLink,
          name: card.headline || metaCfg.headline || page.name || "",
          description: card.description || metaCfg.description || "",
          ...(cardCta ? { call_to_action: cardCta } : {}),
        });
      }
    }
    objectStorySpec = {
      page_id: String(pageId),
      link_data: {
        message: post.caption || "",
        link: baseLink,
        multi_share_optimized: false,
        child_attachments: childAttachments,
      },
    };
  }

  const creativeRes = await graphPost(`https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(actId)}/adcreatives`, {
    access_token: adsToken,
    name: `EZA_${metaCfg.format}_${Date.now()}`,
    object_story_spec: JSON.stringify(objectStorySpec),
  });

  const creativeInfo = await graphRequest(creativeRes.id, {
    access_token: adsToken,
    fields: "effective_object_story_id",
  });
  const storyId = String(creativeInfo.effective_object_story_id || creativeRes.id);

  if (!metaCfg.isDarkPost && creativeInfo.effective_object_story_id) {
    try {
      await graphPost(`https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(storyId)}`, {
        access_token: pageToken,
        is_published: "true",
      });
    } catch (pubErr) {
      throw new Error(
        `បានបង្កើត Dark Post (${storyId}) ក្នុង Ads Manager ជោគជ័យ ប៉ុន្តែ Meta មិនអនុញ្ញាតឱ្យបើកឡើង Timeline ដោយផ្ទាល់ទេ (${pubErr?.message}) — សូមជ្រើសរើស 'Dark Post (PE)'។`
      );
    }
  }

  return storyId;
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
      message: result?.error?.message,
    });
    throw new Error(result?.error?.message || "Facebook request failed.");
  }
  return result;
}

function assertAllowedCarouselImageUrl(value, isPagePicture) {
  if (!isPagePicture) {
    assertValidMediaUrl(value, "image");
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

function parseR2MediaKey(mediaUrl) {
  if (typeof mediaUrl !== "string" || !mediaUrl.includes("/api/v1/media/")) return null;
  try {
    const parsed = new URL(mediaUrl);
    const rawKey = parsed?.pathname?.split("/api/v1/media/")[1];
    return rawKey ? decodeURIComponent(rawKey) : null;
  } catch {
    return null;
  }
}

async function uploadFacebookReelViaRupload(pageId, pageToken, mediaUrl, caption, env) {
  const reelsEndpoint = `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(pageId)}/video_reels`;
  const startRes = await fetch(reelsEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageToken,
      upload_phase: "start",
    }),
  });
  const startData = await startRes.json().catch(() => ({}));
  if (!startRes.ok || startData?.error || !startData?.video_id) {
    const errMsg = formatResumableError(startData, startRes.status, "reels-start");
    if (Number(startData?.error?.code) === 1) {
      throw new Error(
        `${errMsg} — Meta Graph API បដិសេធការផុស Reels ដោយ Token នេះ (ត្រូវការ Facebook Login OAuth ដែលមានសិទ្ធិ publish_video + pages_manage_posts)`
      );
    }
    throw new Error(errMsg);
  }

  const videoId = String(startData.video_id);
  const uploadUrl =
    typeof startData.upload_url === "string" && startData.upload_url.startsWith("https://")
      ? startData.upload_url
      : `https://rupload.facebook.com/video-upload/${graphApiVersion}/${encodeURIComponent(videoId)}`;

  const key = env?.MEDIA_BUCKET ? parseR2MediaKey(mediaUrl) : null;
  const r2Object = key ? await env.MEDIA_BUCKET.get(key) : null;

  let transferRes;
  if (r2Object) {
    const bytes = await r2Object.arrayBuffer();
    transferRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${pageToken}`,
        offset: "0",
        file_size: String(bytes.byteLength),
        "Content-Type": "application/octet-stream",
      },
      body: bytes,
    });
  } else {
    transferRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${pageToken}`,
        file_url: mediaUrl,
      },
    });
  }

  const transferData = await transferRes.json().catch(() => ({}));
  if (!transferRes.ok || transferData?.error || transferData?.success === false) {
    throw new Error(formatResumableError(transferData, transferRes.status, "reels-rupload"));
  }

  const finishRes = await fetch(reelsEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageToken,
      video_id: videoId,
      upload_phase: "finish",
      video_state: "PUBLISHED",
      description: caption || "",
    }),
  });
  const finishData = await finishRes.json().catch(() => ({}));
  if (!finishRes.ok || finishData?.error || finishData?.success === false) {
    throw new Error(formatResumableError(finishData, finishRes.status, "reels-finish"));
  }

  return String(finishData?.id || videoId);
}

async function uploadFacebookMedia(binaryEndpoint, urlEndpoint, mediaUrl, fields, urlFieldName, env) {
  if (env?.MEDIA_BUCKET && typeof mediaUrl === "string" && mediaUrl.includes("/api/v1/media/")) {
    let parsed = null;
    try {
      parsed = new URL(mediaUrl);
    } catch {
      parsed = null;
    }
    const rawKey = parsed?.pathname?.split("/api/v1/media/")[1];
    if (rawKey) {
      const key = decodeURIComponent(rawKey);
      const object = await env.MEDIA_BUCKET.get(key);
      if (object) {
        const bytes = await object.arrayBuffer();
        const contentType = object.httpMetadata?.contentType || (urlFieldName === "file_url" ? "video/mp4" : "image/jpeg");
        const filename = key.split("/").pop() || (urlFieldName === "file_url" ? "video.mp4" : "image.jpg");
        const form = new FormData();
        for (const [k, v] of Object.entries(fields)) {
          form.set(k, String(v));
        }
        form.set("source", new Blob([bytes], { type: contentType }), filename);

        const response = await fetch(binaryEndpoint, { method: "POST", body: form });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.error || (typeof result.id !== "string" && typeof result.post_id !== "string")) {
          const binErr = result?.error;
          const binErrSummary = binErr
            ? `${binErr.message || "Binary upload failed"}${binErr.code != null ? ` (FB #${binErr.code}${binErr.error_subcode ? `/${binErr.error_subcode}` : ""})` : ""}`
            : `HTTP ${response.status}`;
          console.error("Facebook binary media upload failed:", {
            endpoint: binaryEndpoint,
            status: response.status,
            code: binErr?.code,
            subcode: binErr?.error_subcode,
            message: binErr?.message,
          });
          if (isFacebookHardStopError(binErr) && !(fields?.published === "false" && Number(binErr?.code) === 100)) {
            const code = Number(binErr?.code);
            let hint;
            if (code === 190 || code === 368 || code === 459) {
              hint = " — សម័យ Facebook ផុតកំណត់ ឬជាប់ការពារសុវត្ថិភាព (សូមឈប់ផុសមួយរយៈ ហើយ Sync Extension ថ្មី)";
            } else if (code === 1 && String(binaryEndpoint).includes("/videos")) {
              hint = " — Meta Graph API បដិសេធការផុសវីដេអូដោយ Token ពី Extension (ខ្វះសិទ្ធិ publish_video ផ្លូវការ)។ ត្រូវភ្ជាប់តាម Facebook Login (OAuth App) ដែលមានសិទ្ធិ publish_video + pages_manage_posts ទើបអាចផុសវីដេអូបាន។";
            } else {
              hint = " — Token របស់ផេកនេះខ្វះសិទ្ធិបង្ហោះ ឬ Meta បដិសេធសំណើ។";
            }
            throw new Error(`${binErrSummary}${hint}`);
          }
          // Try URL-based upload on binaryEndpoint (e.g. graph-video.facebook.com file_url) then urlEndpoint
          if (binaryEndpoint !== urlEndpoint) {
            try {
              return await graphPost(binaryEndpoint, {
                ...fields,
                [urlFieldName]: mediaUrl,
              });
            } catch (videoUrlErr) {
              if (isFacebookHardStopError(videoUrlErr)) throw videoUrlErr;
              console.warn("Facebook binaryEndpoint file_url fallback failed:", videoUrlErr?.message);
            }
          }
          try {
            return await graphPost(urlEndpoint, {
              ...fields,
              [urlFieldName]: mediaUrl,
            });
          } catch (urlErr) {
            if (isFacebookHardStopError(urlErr)) throw urlErr;
            // Last-resort 3-phase Resumable Video Upload on graph-video.facebook.com
            let resumableSummary = "";
            if (urlFieldName === "file_url" && fields?.published !== "false" && bytes?.byteLength > 0) {
              try {
                return await uploadFacebookVideoResumable(binaryEndpoint, bytes, contentType, filename, fields);
              } catch (resumableErr) {
                resumableSummary = resumableErr?.message ? ` [resumable: ${resumableErr.message}]` : "";
                console.warn("Facebook resumable video upload fallback failed:", resumableErr?.message);
              }
            }
            const combined = `${urlErr?.message || "Facebook upload failed."} [binary: ${binErrSummary}]${resumableSummary}`;
            const hint = /FB #(190|368|459)\b/i.test(combined)
              ? " — សម័យ Facebook ផុតកំណត់ ឬជាប់ការពារសុវត្ថិភាព (សូមឈប់ផុសមួយរយៈ ហើយ Sync Extension ថ្មី)"
              : /FB #(1|200)\b|Invalid request/i.test(combined)
              ? " — Meta Graph API បដិសេធ Token នេះដោយសារខ្វះសិទ្ធិផុសផ្លូវការ (publish_video / pages_manage_posts) — ត្រូវការ Facebook Login (OAuth App)"
              : "";
            throw new Error(`${combined}${hint}`);
          }
        }
        return result;
      }
    }
  }

  return graphPost(urlEndpoint, {
    ...fields,
    [urlFieldName]: mediaUrl,
  });
}

function formatResumableError(data, fallbackStatus, phase) {
  const err = data?.error;
  if (err?.message) {
    const codeTag = err.code != null
      ? ` (FB #${err.code}${err.error_subcode ? `/${err.error_subcode}` : ""})`
      : "";
    return `${err.message}${codeTag}`;
  }
  return `Resumable ${phase} failed (${fallbackStatus})`;
}

async function uploadFacebookVideoResumable(binaryEndpoint, bytes, contentType, filename, fields) {
  const accessToken = String(fields?.access_token || "");
  const startRes = await fetch(binaryEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: accessToken,
      upload_phase: "start",
      file_size: String(bytes.byteLength),
    }),
  });
  const startData = await startRes.json().catch(() => ({}));
  if (!startRes.ok || startData?.error || !startData?.upload_session_id) {
    throw new Error(formatResumableError(startData, startRes.status, "start"));
  }

  const sessionId = String(startData.upload_session_id);
  const transferForm = new FormData();
  transferForm.set("access_token", accessToken);
  transferForm.set("upload_phase", "transfer");
  transferForm.set("upload_session_id", sessionId);
  transferForm.set("start_offset", String(startData.start_offset ?? 0));
  transferForm.set("video_file_chunk", new Blob([bytes], { type: contentType }), filename);

  const transferRes = await fetch(binaryEndpoint, { method: "POST", body: transferForm });
  const transferData = await transferRes.json().catch(() => ({}));
  if (!transferRes.ok || transferData?.error) {
    throw new Error(formatResumableError(transferData, transferRes.status, "transfer"));
  }

  const finishParams = {
    ...fields,
    access_token: accessToken,
    upload_phase: "finish",
    upload_session_id: sessionId,
  };
  const finishRes = await fetch(binaryEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(finishParams),
  });
  const finishData = await finishRes.json().catch(() => ({}));
  if (!finishRes.ok || finishData?.error || (!finishData?.success && !finishData?.id && !startData?.video_id)) {
    throw new Error(formatResumableError(finishData, finishRes.status, "finish"));
  }
  return { id: String(finishData?.id || startData.video_id) };
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
    const fbErr = result?.error;
    console.error("Facebook publish request failed:", {
      url,
      status: response.status,
      code: fbErr?.code,
      subcode: fbErr?.error_subcode,
      message: fbErr?.message,
    });
    if (fbErr) {
      const baseMsg = fbErr.error_user_msg && fbErr.error_user_msg !== fbErr.message
        ? `${fbErr.message} — ${fbErr.error_user_msg}`
        : fbErr.message || "Facebook post failed.";
      const codeTag = fbErr.code != null
        ? ` (FB #${fbErr.code}${fbErr.error_subcode ? `/${fbErr.error_subcode}` : ""})`
        : "";
      throw new Error(`${baseMsg}${codeTag}`);
    }
    throw new Error("Facebook post failed.");
  }
  return result;
}

function assertValidMediaUrl(value, resourceType) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Post media URL is invalid.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Post media URL must be HTTPS.");
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
