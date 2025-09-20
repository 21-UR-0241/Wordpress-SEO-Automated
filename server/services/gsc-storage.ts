// server/services/gsc-storage.ts - COMPLETE VERSION WITH FIX
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// Use your existing Neon database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

interface GscConfiguration {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GscAccount {
  id: string;  // This is the Google account ID (for compatibility)
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
  isActive: boolean;
}

export const gscStorage = {
  // Configuration management - matches gsc_configurations table
  async saveGscConfiguration(userId: string, config: GscConfiguration) {
    const query = `
      INSERT INTO gsc_configurations (user_id, client_id, client_secret, redirect_uri)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(user_id) DO UPDATE SET
        client_id = EXCLUDED.client_id,
        client_secret = EXCLUDED.client_secret,
        redirect_uri = EXCLUDED.redirect_uri,
        updated_at = NOW()
      RETURNING *
    `;
    
    const values = [userId, config.clientId, config.clientSecret, config.redirectUri];
    await pool.query(query, values);
    return config;
  },

  async getGscConfiguration(userId: string): Promise<GscConfiguration | null> {
    const query = 'SELECT client_id, client_secret, redirect_uri FROM gsc_configurations WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      clientId: row.client_id,
      clientSecret: row.client_secret,
      redirectUri: row.redirect_uri
    };
  },

  // FIXED: Account management with explicit ID generation
  async saveGscAccount(userId: string, account: GscAccount) {
    // Generate UUID explicitly to avoid null ID error
    const dbId = randomUUID();
    
    const query = `
      INSERT INTO gsc_accounts (
        id,  -- Explicitly include id
        user_id, 
        account_id, 
        email, 
        name, 
        picture, 
        access_token, 
        refresh_token, 
        token_expiry, 
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT(user_id, account_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expiry = EXCLUDED.token_expiry,
        is_active = EXCLUDED.is_active,
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        picture = EXCLUDED.picture,
        updated_at = NOW()
      RETURNING *
    `;
    
    // Convert milliseconds to seconds for INTEGER column
    const tokenExpiryInSeconds = Math.floor(account.tokenExpiry / 1000);
    
    const values = [
      dbId,  // Generated UUID
      userId,
      account.id,  // Google account ID goes in account_id column
      account.email,
      account.name,
      account.picture || null,
      account.accessToken,
      account.refreshToken,
      tokenExpiryInSeconds,
      account.isActive !== false
    ];
    
    const result = await pool.query(query, values);
    return account;
  },

  // Get account using account_id column
  async getGscAccount(userId: string, accountId: string): Promise<GscAccount | null> {
    const query = 'SELECT * FROM gsc_accounts WHERE user_id = $1 AND account_id = $2';
    const result = await pool.query(query, [userId, accountId]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.account_id,  // Return the Google account ID
      email: row.email,
      name: row.name,
      picture: row.picture,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiry: row.token_expiry * 1000, // Convert seconds back to milliseconds
      isActive: row.is_active
    };
  },

  // Get account with credentials using account_id column
  async getGscAccountWithCredentials(userId: string, accountId: string) {
    const query = `
      SELECT 
        a.id as db_id,
        a.account_id,
        a.email,
        a.name,
        a.picture,
        a.access_token,
        a.refresh_token,
        a.token_expiry,
        a.is_active,
        c.client_id,
        c.client_secret,
        c.redirect_uri
      FROM gsc_accounts a
      JOIN gsc_configurations c ON c.user_id = a.user_id
      WHERE a.user_id = $1 AND a.account_id = $2
    `;
    const result = await pool.query(query, [userId, accountId]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.account_id,  // Return the Google account ID for compatibility
      accountId: row.account_id,
      email: row.email,
      name: row.name,
      picture: row.picture,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiry: row.token_expiry * 1000,
      isActive: row.is_active,
      clientId: row.client_id,
      clientSecret: row.client_secret,
      redirectUri: row.redirect_uri
    };
  },

  // Update account using account_id column
  async updateGscAccount(userId: string, accountId: string, updates: Partial<GscAccount>) {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.accessToken !== undefined) {
      fields.push(`access_token = $${paramCount++}`);
      values.push(updates.accessToken);
    }

    if (updates.refreshToken !== undefined) {
      fields.push(`refresh_token = $${paramCount++}`);
      values.push(updates.refreshToken);
    }

    if (updates.tokenExpiry !== undefined) {
      fields.push(`token_expiry = $${paramCount++}`);
      values.push(Math.floor(updates.tokenExpiry / 1000));
    }

    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(updates.isActive);
    }

    if (fields.length === 0) return { success: true };

    values.push(userId, accountId);

    const query = `
      UPDATE gsc_accounts 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE user_id = $${paramCount} AND account_id = $${paramCount + 1}
      RETURNING *
    `;
    
    await pool.query(query, values);
    return { success: true };
  },

  // Get all accounts using account_id column
  async getAllGscAccounts(userId: string): Promise<GscAccount[]> {
    const query = 'SELECT * FROM gsc_accounts WHERE user_id = $1 ORDER BY created_at DESC';
    const result = await pool.query(query, [userId]);
    
    return result.rows.map(row => ({
      id: row.account_id,  // Return the Google account ID
      email: row.email,
      name: row.name,
      picture: row.picture,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiry: row.token_expiry * 1000,
      isActive: row.is_active
    }));
  },

  // Delete account using account_id column
  async deleteGscAccount(userId: string, accountId: string) {
    const query = 'DELETE FROM gsc_accounts WHERE user_id = $1 AND account_id = $2';
    await pool.query(query, [userId, accountId]);
    return { success: true };
  },

  // Properties management - uses account_id correctly
  async saveGscProperty(userId: string, accountId: string, property: any) {
    const propertyId = randomUUID(); // Generate ID for property too
    
    const query = `
      INSERT INTO gsc_properties (
        id, user_id, account_id, site_url, permission_level, 
        site_type, verified, last_synced
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT(site_url) DO UPDATE SET
        permission_level = EXCLUDED.permission_level,
        verified = EXCLUDED.verified,
        last_synced = NOW(),
        updated_at = NOW()
      RETURNING *
    `;
    
    const values = [
      propertyId,
      userId,
      accountId,
      property.siteUrl,
      property.permissionLevel,
      property.siteType,
      property.verified
    ];
    
    await pool.query(query, values);
    return property;
  },

  async getGscProperties(userId: string, accountId?: string) {
    let query = 'SELECT * FROM gsc_properties WHERE user_id = $1';
    const values: any[] = [userId];
    
    if (accountId) {
      query += ' AND account_id = $2';
      values.push(accountId);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, values);
    return result.rows;
  },

  // Quota management - handles both old and new structure
  async getGscQuotaUsage(accountId: string) {
    const quotaId = randomUUID(); // Generate ID if needed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use DATE type for date column
    const todayDate = today.toISOString().split('T')[0];
    
    // First check if record exists for today
    let query = `
      SELECT count, limit_count 
      FROM gsc_quota_usage 
      WHERE account_id = $1 AND date::date = $2::date
    `;
    let result = await pool.query(query, [accountId, todayDate]);
    
    if (result.rows.length === 0) {
      // Create record for today with explicit ID
      query = `
        INSERT INTO gsc_quota_usage (id, account_id, date, count, limit_count)
        VALUES ($1, $2, $3::date, 0, 200)
        RETURNING count, limit_count
      `;
      result = await pool.query(query, [quotaId, accountId, todayDate]);
    }
    
    return {
      used: result.rows[0].count || 0,
      limit: result.rows[0].limit_count || 200
    };
  },

  async incrementGscQuotaUsage(accountId: string, url?: string) {
    const quotaId = randomUUID();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = today.toISOString().split('T')[0];
    
    // Increment quota count with explicit ID
    const query = `
      INSERT INTO gsc_quota_usage (id, account_id, date, count, limit_count)
      VALUES ($1, $2, $3::date, 1, 200)
      ON CONFLICT(account_id, date) DO UPDATE SET
        count = gsc_quota_usage.count + 1,
        updated_at = NOW()
      RETURNING count
    `;
    
    const result = await pool.query(query, [quotaId, accountId, todayDate]);
    
    // Also track in indexing requests if URL provided
    if (url) {
      await this.trackIndexingRequest(accountId, url, 'pending');
    }
    
    return { success: true, count: result.rows[0].count };
  },

  // Indexing requests tracking
  async trackIndexingRequest(accountId: string, url: string, status: string) {
    const requestId = randomUUID(); // Generate ID for request
    
    // Get property ID for this URL
    const propertyQuery = `
      SELECT id FROM gsc_properties 
      WHERE account_id = $1 
      AND $2 LIKE site_url || '%'
      LIMIT 1
    `;
    const propertyResult = await pool.query(propertyQuery, [accountId, url]);
    
    if (propertyResult.rows.length === 0) {
      // If no property found, skip tracking
      return { success: false, message: 'No matching property found' };
    }
    
    const propertyId = propertyResult.rows[0].id;
    
    // Get user_id from account using account_id column
    const userQuery = 'SELECT user_id FROM gsc_accounts WHERE account_id = $1 LIMIT 1';
    const userResult = await pool.query(userQuery, [accountId]);
    
    if (userResult.rows.length === 0) {
      return { success: false, message: 'Account not found' };
    }
    
    const userId = userResult.rows[0].user_id;
    
    const query = `
      INSERT INTO gsc_indexing_requests (
        id, user_id, account_id, property_id, url, type, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, 'URL_UPDATED', $6, NOW())
    `;
    
    await pool.query(query, [requestId, userId, accountId, propertyId, url, status]);
    return { success: true };
  },

  // Performance data
  async savePerformanceData(propertyId: string, data: any[]) {
    const query = `
      INSERT INTO gsc_performance_data (
        id, property_id, date, clicks, impressions, ctr, position
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT DO NOTHING
    `;
    
    for (const row of data) {
      const perfId = randomUUID();
      await pool.query(query, [
        perfId,
        propertyId,
        row.date,
        row.clicks,
        row.impressions,
        row.ctr,
        row.position
      ]);
    }
    
    return { success: true };
  },

  // URL Inspections
  async saveUrlInspection(propertyId: string, inspection: any) {
    const inspectionId = randomUUID();
    
    const query = `
      INSERT INTO gsc_url_inspections (
        id, property_id, url, index_status, last_crawl_time,
        page_fetch_state, google_canonical, user_canonical,
        mobile_usability, rich_results_status, full_result,
        inspected_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `;
    
    const values = [
      inspectionId,
      propertyId,
      inspection.url,
      inspection.indexStatus,
      inspection.lastCrawlTime || null,
      inspection.pageFetchState || null,
      inspection.googleCanonical || null,
      inspection.userCanonical || null,
      inspection.mobileUsability || null,
      inspection.richResultsStatus || null,
      JSON.stringify(inspection)
    ];
    
    await pool.query(query, values);
    return { success: true };
  },

  // Sitemaps
  async saveSitemap(propertyId: string, sitemapUrl: string) {
    const sitemapId = randomUUID();
    
    const query = `
      INSERT INTO gsc_sitemaps (id, property_id, sitemap_url, status, last_submitted)
      VALUES ($1, $2, $3, 'submitted', NOW())
      ON CONFLICT DO NOTHING
    `;
    
    await pool.query(query, [sitemapId, propertyId, sitemapUrl]);
    return { success: true };
  },

  // Helper method for debugging
  async getAccountsByGoogleId(googleAccountId: string) {
    const query = `
      SELECT user_id, email, name 
      FROM gsc_accounts 
      WHERE account_id = $1
    `;
    const result = await pool.query(query, [googleAccountId]);
    return result.rows;
  }
};

// Table creation functions (if needed)
export const createGscTables = async () => {
  console.log('GSC tables already exist in Neon database');
  return true;
};

export const migrateGscTables = async () => {
  console.log('GSC tables already configured in Neon database');
  return true;
};
