// backend/services/wordpress-seo-plugin-service.ts
export class WordPressSEOPluginService {
  private async detectSEOPlugin(creds: any): Promise<string> {
    const pluginsEndpoint = `${creds.url}/wp-json/wp/v2/plugins`;
    
    try {
      const response = await fetch(pluginsEndpoint, {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${creds.username}:${creds.applicationPassword}`
          ).toString("base64")}`,
        },
      });
      
      if (response.ok) {
        const plugins = await response.json();
        if (plugins.find((p: any) => p.slug === 'wordpress-seo')) return 'yoast';
        if (plugins.find((p: any) => p.slug === 'seo-by-rank-math')) return 'rankmath';
        if (plugins.find((p: any) => p.slug === 'all-in-one-seo-pack')) return 'aioseo';
      }
    } catch (error) {
      console.log("Could not detect SEO plugin via REST API, trying alternative method");
    }
    
    // Alternative: Check if Yoast REST API endpoint exists
    try {
      const yoastCheck = await fetch(`${creds.url}/wp-json/yoast/v1/`);
      if (yoastCheck.ok) return 'yoast';
    } catch {}
    
    return 'none';
  }

  async updateSEOFields(
    creds: any,
    postId: number,
    seoData: {
      metaDescription?: string;
      seoTitle?: string;
      focusKeyword?: string;
    },
    contentType: string = 'post'
  ): Promise<boolean> {
    const seoPlugin = await this.detectSEOPlugin(creds);
    console.log(`Detected SEO plugin: ${seoPlugin}`);
    
    const metaFields: Record<string, any> = {};
    
    switch (seoPlugin) {
      case 'yoast':
        if (seoData.metaDescription) {
          metaFields['yoast_wpseo_metadesc'] = seoData.metaDescription;
        }
        if (seoData.seoTitle) {
          metaFields['yoast_wpseo_title'] = seoData.seoTitle;
        }
        break;
        
      case 'rankmath':
        if (seoData.metaDescription) {
          metaFields['rank_math_description'] = seoData.metaDescription;
        }
        if (seoData.seoTitle) {
          metaFields['rank_math_title'] = seoData.seoTitle;
        }
        break;
    }
    
    // Update via REST API
    const endpoint = `${creds.url}/wp-json/wp/v2/${contentType}s/${postId}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${creds.username}:${creds.applicationPassword}`
        ).toString("base64")}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meta: metaFields,
        // Also update excerpt as fallback
        excerpt: seoData.metaDescription
      }),
    });
    
    if (!response.ok) {
      console.error(`Failed to update SEO fields: ${response.statusText}`);
      return false;
    }
    
    return true;
  }
}

export const wpSEOService = new WordPressSEOPluginService();