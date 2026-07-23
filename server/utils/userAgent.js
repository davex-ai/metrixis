/**
 * Minimal User-Agent parsing — good enough for device/browser/OS buckets
 * without pulling in a heavy dependency. Not exhaustive, but covers the
 * vast majority of real traffic.
 */
function parseUserAgent(uaString = '') {
  const ua = uaString.toLowerCase();

  // Device type
  let deviceType = 'desktop';
  if (/tablet|ipad/.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobi|android|iphone/.test(ua)) {
    deviceType = 'mobile';
  }

  // Browser
  let browser = 'Other';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') && !ua.includes('edg/')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Safari';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';

  // OS
  let os = 'Other';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';

  return { deviceType, browser, os };
}

module.exports = { parseUserAgent };
