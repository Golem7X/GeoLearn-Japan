/**
 * ============================================================
 * GeoLearn Japan — GA4 Automated Email Report (Google Apps Script)
 * ============================================================
 *
 * SETUP INSTRUCTIONS:
 *
 * 1. Go to https://script.google.com and create a new project
 *    - Name it: "GeoLearn Japan Analytics Reports"
 *
 * 2. Enable the Google Analytics Data API:
 *    - In the script editor, click "Services" (+ icon) on the left sidebar
 *    - Search for "Google Analytics Data API"
 *    - Select it and click "Add"
 *    - It will appear as "AnalyticsData" in the Services list
 *
 * 3. Copy this ENTIRE file content and paste it into the script editor
 *    (replace the default myFunction code)
 *
 * 4. Update the CONFIG section below with your values:
 *    - PROPERTY_ID: Your GA4 property ID (numeric, found in Admin > Property Settings)
 *    - EMAIL: Your developer email address
 *
 * 5. Set up automated triggers:
 *    - Click the clock icon (Triggers) in the left sidebar
 *    - Click "+ Add Trigger"
 *    - Create 3 triggers:
 *
 *      a) Daily Report:
 *         Function: sendDailyReport
 *         Event source: Time-driven
 *         Type: Day timer
 *         Time: 8am to 9am (or your preference)
 *
 *      b) Weekly Report:
 *         Function: sendWeeklyReport
 *         Event source: Time-driven
 *         Type: Week timer
 *         Day: Monday
 *         Time: 8am to 9am
 *
 *      c) Monthly Report:
 *         Function: sendMonthlyReport
 *         Event source: Time-driven
 *         Type: Month timer
 *         Day: 1
 *         Time: 8am to 9am
 *
 * 6. Run sendDailyReport() manually once to authorize permissions
 *    - Click "Run" button
 *    - Accept the permission prompts
 *
 * 7. Done! You'll receive email reports automatically.
 *
 * ============================================================
 */

// ==================== CONFIG ====================
var CONFIG = {
  PROPERTY_ID: 'YOUR_GA4_PROPERTY_ID',  // e.g., '123456789' (numeric ID, NOT the G-XXXXXXXXXX)
  EMAIL: 'YOUR_EMAIL@gmail.com',         // Your developer email
  APP_NAME: 'GeoLearn Japan',
  APP_URL: 'https://golem7x.github.io/GeoLearn-Japan/'
};
// ================================================

/**
 * Fetch GA4 report data using the Analytics Data API
 */
function fetchGA4Report(startDate, endDate) {
  var request = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'averageSessionDuration' },
      { name: 'screenPageViews' },
      { name: 'engagementRate' }
    ]
  }, 'properties/' + CONFIG.PROPERTY_ID);

  var row = request.rows && request.rows.length > 0 ? request.rows[0] : null;
  if (!row) {
    return { users: 0, sessions: 0, avgDuration: '0:00', pageViews: 0, engagementRate: '0%' };
  }

  var vals = row.metricValues;
  var durationSec = parseFloat(vals[2].value || 0);
  var minutes = Math.floor(durationSec / 60);
  var seconds = Math.round(durationSec % 60);

  return {
    users: parseInt(vals[0].value || 0),
    sessions: parseInt(vals[1].value || 0),
    avgDuration: minutes + ':' + (seconds < 10 ? '0' : '') + seconds,
    pageViews: parseInt(vals[3].value || 0),
    engagementRate: (parseFloat(vals[4].value || 0) * 100).toFixed(1) + '%'
  };
}

/**
 * Fetch top pages from GA4
 */
function fetchTopPages(startDate, endDate, limit) {
  var request = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    dimensions: [{ name: 'pageTitle' }],
    metrics: [{ name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: limit || 5
  }, 'properties/' + CONFIG.PROPERTY_ID);

  var pages = [];
  if (request.rows) {
    for (var i = 0; i < request.rows.length; i++) {
      pages.push({
        title: request.rows[i].dimensionValues[0].value,
        views: parseInt(request.rows[i].metricValues[0].value)
      });
    }
  }
  return pages;
}

/**
 * Build HTML email report
 */
function buildEmailHTML(period, periodLabel, data, topPages) {
  var pagesHTML = '';
  for (var i = 0; i < topPages.length; i++) {
    var rank = i + 1;
    pagesHTML += '<tr><td style="padding:8px 12px;border-bottom:1px solid #1e293b;">' + rank + '</td>'
      + '<td style="padding:8px 12px;border-bottom:1px solid #1e293b;">' + topPages[i].title + '</td>'
      + '<td style="padding:8px 12px;border-bottom:1px solid #1e293b;text-align:right;">' + topPages[i].views + '</td></tr>';
  }

  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0e17;font-family:Arial,sans-serif;">'
    + '<div style="max-width:600px;margin:20px auto;background:#111827;border-radius:12px;overflow:hidden;border:1px solid #1e293b;">'

    // Header
    + '<div style="background:linear-gradient(135deg,#0d1b2a,#1a2744);padding:24px;text-align:center;">'
    + '<h1 style="margin:0;color:#00d4ff;font-size:22px;">' + CONFIG.APP_NAME + '</h1>'
    + '<p style="margin:4px 0 0;color:#8892a4;font-size:13px;">Activity Report — ' + periodLabel + '</p>'
    + '<p style="margin:2px 0 0;color:#4a5568;font-size:11px;">' + period + '</p>'
    + '</div>'

    // Metrics grid
    + '<div style="padding:20px;">'
    + '<table style="width:100%;border-collapse:collapse;">'
    + '<tr>'
    + _metricCell('Active Users', data.users, '#00d4ff')
    + _metricCell('Sessions', data.sessions, '#10b981')
    + '</tr><tr>'
    + _metricCell('Avg Duration', data.avgDuration, '#f59e0b')
    + _metricCell('Page Views', data.pageViews, '#8b5cf6')
    + '</tr><tr>'
    + _metricCell('Engagement', data.engagementRate, '#ec4899')
    + '<td></td>'
    + '</tr>'
    + '</table>'
    + '</div>'

    // Top pages
    + '<div style="padding:0 20px 20px;">'
    + '<h3 style="color:#e2e8f0;font-size:14px;margin:0 0 8px;">Top Pages</h3>'
    + '<table style="width:100%;border-collapse:collapse;color:#cbd5e1;font-size:13px;">'
    + '<tr style="color:#64748b;font-size:11px;text-transform:uppercase;">'
    + '<th style="padding:6px 12px;text-align:left;border-bottom:1px solid #1e293b;">#</th>'
    + '<th style="padding:6px 12px;text-align:left;border-bottom:1px solid #1e293b;">Page</th>'
    + '<th style="padding:6px 12px;text-align:right;border-bottom:1px solid #1e293b;">Views</th>'
    + '</tr>'
    + pagesHTML
    + '</table>'
    + '</div>'

    // Footer
    + '<div style="padding:16px;text-align:center;border-top:1px solid #1e293b;">'
    + '<a href="https://analytics.google.com" style="color:#00d4ff;font-size:12px;text-decoration:none;">View Full Dashboard →</a>'
    + '<p style="margin:8px 0 0;color:#4a5568;font-size:10px;">Auto-generated by GeoLearn Japan Analytics</p>'
    + '</div>'

    + '</div></body></html>';
}

function _metricCell(label, value, color) {
  return '<td style="padding:10px;"><div style="background:#0f172a;border-radius:8px;padding:14px;text-align:center;">'
    + '<div style="color:' + color + ';font-size:24px;font-weight:bold;">' + value + '</div>'
    + '<div style="color:#64748b;font-size:11px;margin-top:4px;">' + label + '</div>'
    + '</div></td>';
}

/**
 * Send report email
 */
function sendReport(periodType, periodLabel, startDate, endDate) {
  var data = fetchGA4Report(startDate, endDate);
  var topPages = fetchTopPages(startDate, endDate, 5);
  var period = startDate + ' to ' + endDate;
  var html = buildEmailHTML(period, periodLabel, data, topPages);
  var subject = CONFIG.APP_NAME + ' ' + periodLabel + ' Report — ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy');

  MailApp.sendEmail({
    to: CONFIG.EMAIL,
    subject: subject,
    htmlBody: html
  });
}

// ==================== TRIGGER FUNCTIONS ====================

function sendDailyReport() {
  var yesterday = _dateStr(1);
  sendReport('daily', 'Daily', yesterday, yesterday);
}

function sendWeeklyReport() {
  var endDate = _dateStr(1);  // yesterday
  var startDate = _dateStr(7); // 7 days ago
  sendReport('weekly', 'Weekly', startDate, endDate);
}

function sendMonthlyReport() {
  var endDate = _dateStr(1);   // yesterday
  var startDate = _dateStr(30); // 30 days ago
  sendReport('monthly', 'Monthly', startDate, endDate);
}

/**
 * Manual test — run this to verify everything works
 */
function testReport() {
  var today = _dateStr(0);
  var weekAgo = _dateStr(7);
  sendReport('test', 'Test', weekAgo, today);
}

// Helper: get date string N days ago in YYYY-MM-DD format
function _dateStr(daysAgo) {
  var d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
