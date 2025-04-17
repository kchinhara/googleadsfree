/**
 * adScraper.js - Google Ads scraper for Google Ads Scripts by Kudakwashe Chinhara
 * 
 * This script scrapes Google Ads using the ValueSERP API and writes the results to a 
 * specified Google Sheet using Google Ads Scripts.
 */

/* Configuration
 * Make a copy of this sheet https://docs.google.com/spreadsheets/d/1Qs7w66TfpvXo4bL-97Kgj5riraM41v_kRrziIEWTt-0/edit?usp=sharing
 * Paste the URL of your new Google Sheet between the single quotes below.
*/
const SPREADSHEET_URL = '';

// Only make changes below here if, like me, you love FAFO-ing

/**
 * Get Google domain settings from a country code
 * 
 * @param {string} countryCode - Two-letter country code (e.g., "UK", "US", "AE")
 * @return {Object} Object containing domain and gl settings
 */
function getDomainSettings(countryCode) {
  if (!countryCode) {
    return { domain: 'google.com', gl: 'us' }; // Default to US
  }
  
  // Convert to lowercase for consistent handling
  const code = countryCode.toLowerCase();
  
  // Special cases for countries with non-standard domain patterns
  const specialDomains = {
    'uk': { domain: 'google.co.uk', gl: 'uk' },
    'gb': { domain: 'google.co.uk', gl: 'uk' }, // Great Britain (United Kingdom)
    'in': { domain: 'google.co.in', gl: 'in' },
    'jp': { domain: 'google.co.jp', gl: 'jp' },
    'kr': { domain: 'google.co.kr', gl: 'kr' },
    'nz': { domain: 'google.co.nz', gl: 'nz' },
    'za': { domain: 'google.co.za', gl: 'za' },
    'us': { domain: 'google.com', gl: 'us' } // US uses the default domain
  };
  
  // If it's a special case, use that
  if (specialDomains[code]) {
    return specialDomains[code];
  }
  
  // For all other country codes, use the standard pattern
  return {
    domain: `google.${code}`,
    gl: code
  };
}

/**
 * Main function to be triggered from Google Ads Scripts
 */
function main() {
  try {
    // Open spreadsheet by URL
    const spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    if (!spreadsheet) {
      Logger.log(`Could not open spreadsheet at URL: ${SPREADSHEET_URL}`);
      return;
    }
    
    // Get input values from named ranges
    const apiKey = getNamedRangeValue(spreadsheet, 'valueSERP_API_KEY');
    const location = getNamedRangeValue(spreadsheet, 'location');
    const countryCode = getNamedRangeValue(spreadsheet, 'countryCode');
    const keywords = getNamedRangeValues(spreadsheet, 'keywords');
    
    // Validate inputs
    if (!apiKey) {
      Logger.log('API key not found. Please set the valueSERP_API_KEY named range.');
      return;
    }
    
    if (!location) {
      Logger.log('Location not found. Please set the location named range.');
      return;
    }
    
    if (!countryCode) {
      Logger.log('Country code not found. Please set the countryCode named range.');
      return;
    }
    
    if (!keywords || keywords.length === 0) {
      Logger.log('No keywords found. Please add keywords to the keywords named range.');
      return;
    }
    
    Logger.log(`Starting ad scraping for ${keywords.length} keywords in ${location} (${countryCode})`);
    
    // Get domain settings dynamically from country code
    const domainSettings = getDomainSettings(countryCode);
    Logger.log(`Using domain: ${domainSettings.domain}, gl: ${domainSettings.gl}`);
    
    // Scrape ads for all keywords
    const allAds = [];
    keywords.forEach(keyword => {
      if (keyword) { // Skip empty cells
        Logger.log(`Scraping ads for: ${keyword}`);
        const ads = scrapeGoogleAds(apiKey, keyword, location, domainSettings);
        if (ads && ads.length > 0) {
          allAds.push(...ads);
          Logger.log(`Found ${ads.length} ads for "${keyword}"`);
        } else {
          Logger.log(`No ads found for "${keyword}"`);
        }
      }
    });
    
    // Write ads to sheet
    if (allAds.length > 0) {
      writeAdsToSheet(spreadsheet, allAds);
      Logger.log(`Successfully wrote ${allAds.length} ads to the Scraped Ads sheet`);
    } else {
      Logger.log('No ads found for any keywords');
    }
  } catch (error) {
    Logger.log(`Error: ${error.message}`);
  }
}

/**
 * Scrape Google Ads for a given keyword and location
 * 
 * @param {string} apiKey - ValueSERP API key
 * @param {string} keyword - Search keyword
 * @param {string} location - Location string (e.g., "Watford,England,United Kingdom")
 * @param {Object} domainSettings - Object containing domain and gl settings
 * @return {Array} Array of ad objects
 */
function scrapeGoogleAds(apiKey, keyword, location, domainSettings) {
  // Prepare API request parameters
  const params = {
    api_key: apiKey,
    q: keyword,
    location: location,
    gl: domainSettings.gl,
    hl: 'en',
    google_domain: domainSettings.domain,
    include_ai_overview: 'true',
    ads_optimized: 'true'
  };
  
  // Build URL with query parameters
  let url = 'https://api.valueserp.com/search?';
  for (const key in params) {
    url += `${key}=${encodeURIComponent(params[key])}&`;
  }
  url = url.slice(0, -1); // Remove trailing &
  
  try {
    // Make API request
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      Logger.log(`API error: ${responseCode} - ${response.getContentText()}`);
      return [];
    }
    
    const data = JSON.parse(response.getContentText());
    Logger.log('API Response received successfully');
    
    // Extract ads from response
    const ads = [];
    if (data.ads && data.ads.length > 0) {
      const now = new Date().toISOString();
      
      data.ads.forEach(ad => {
        // Process each ad, capturing all possible fields
        const adData = {
          keyword: keyword,
          position: ad.position || '',
          block_position: ad.block_position || '',
          relative_block_position: ad.relative_block_position || '',
          title: ad.title || '',
          tracking_link: ad.tracking_link || '',
          link: ad.link || '',
          domain: ad.domain || '',
          displayed_link: ad.displayed_link || '',
          description: ad.description || '',
          sitelinks: ad.sitelinks ? JSON.stringify(ad.sitelinks) : '',
          phone: ad.phone || '',
          location: ad.location || '',
          extensions: ad.extensions ? JSON.stringify(ad.extensions) : '',
          rich_snippet: ad.rich_snippet ? JSON.stringify(ad.rich_snippet) : '',
          scraped_at: now
        };
        
        ads.push(adData);
      });
    }
    
    return ads;
  } catch (error) {
    Logger.log(`Error scraping ads for keyword '${keyword}': ${error.message}`);
    return [];
  }
}

/**
 * Write ads to the Raw Scraped Ads sheet
 * 
 * @param {Spreadsheet} spreadsheet - Google Spreadsheet object
 * @param {Array} ads - Array of ad objects to write
 */
function writeAdsToSheet(spreadsheet, ads) {
  let sheet = spreadsheet.getSheetByName('Raw Scraped Ads');
  
  // Create the sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Raw Scraped Ads');
    
    // Add headers
    const headers = [
      'keyword', 'position', 'block_position', 'relative_block_position', 
      'title', 'tracking_link', 'link', 'domain', 'displayed_link', 
      'description', 'sitelinks', 'phone', 'location', 'extensions', 
      'rich_snippet', 'scraped_at'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  // Get current data (excluding header)
  let existingData = [];
  const lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    existingData = dataRange.getValues();
  }
  
  // Prepare new data in the same order as headers
  const newData = ads.map(ad => [
    ad.keyword || '',
    ad.position || '',
    ad.block_position || '',
    ad.relative_block_position || '',
    ad.title || '',
    ad.tracking_link || '',
    ad.link || '',
    ad.domain || '',
    ad.displayed_link || '',
    ad.description || '',
    ad.sitelinks || '',
    ad.phone || '',
    ad.location || '',
    ad.extensions || '',
    ad.rich_snippet || '',
    ad.scraped_at || ''
  ]);
  
  // Combine new data at the top (below header) with existing data
  const combinedData = newData.concat(existingData);
  
  // Clear existing data and write combined data
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
  
  if (combinedData.length > 0) {
    sheet.getRange(2, 1, combinedData.length, combinedData[0].length).setValues(combinedData);
  }
  
  // Auto-resize columns to fit content
  sheet.autoResizeColumns(1, combinedData[0].length);
}

/**
 * Get the value of a named range
 * 
 * @param {Spreadsheet} spreadsheet - Google Spreadsheet object
 * @param {string} rangeName - Name of the range
 * @return {string} Value of the named range
 */
function getNamedRangeValue(spreadsheet, rangeName) {
  const namedRange = spreadsheet.getRangeByName(rangeName);
  if (!namedRange) {
    Logger.log(`Named range '${rangeName}' not found`);
    return null;
  }
  return namedRange.getValue();
}

/**
 * Get values from a named range that contains multiple cells
 * 
 * @param {Spreadsheet} spreadsheet - Google Spreadsheet object
 * @param {string} rangeName - Name of the range
 * @return {Array} Array of values from the named range
 */
function getNamedRangeValues(spreadsheet, rangeName) {
  const namedRange = spreadsheet.getRangeByName(rangeName);
  if (!namedRange) {
    Logger.log(`Named range '${rangeName}' not found`);
    return [];
  }
  
  // Get all values and flatten the 2D array to 1D
  const values = namedRange.getValues();
  return values.flat().filter(val => val !== '');
}
