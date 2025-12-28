/**
 * Apollo Cache Save Service
 * Handles saving Apollo results to database cache
 * LAD Architecture Compliant
 */

const { pool } = require('../../../shared/database/connection');
const { getSchema } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');

/**
 * Save Apollo employees to database cache
 * @param {Array} employees - Array of employee objects
 * @param {Object} req - Express request object (for tenant context)
 */
async function saveEmployeesToCache(employees, req = null) {
  let client;
  let savedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  
  try {
    // LAD Architecture: Require tenant context (throws error if missing in production)
    const { requireTenantId } = require('../../../core/utils/tenantHelper');
    const effectiveTenantId = requireTenantId(null, req, 'saveEmployeesToCache');
    
    // LAD Architecture: Get dynamic schema (no hardcoded lad_dev)
    const schema = getSchema(req);
    
    client = await pool.connect();
    
    for (const emp of employees) {
      try {
        const apolloPersonId = String(emp.id || emp.person_id || '');
        if (!apolloPersonId || apolloPersonId === '') {
          logger.warn('[Apollo Cache Save] Skipping employee with no apollo_person_id', { name: emp.name });
          errorCount++;
          continue;
        }
        
        // LAD Architecture: Use dynamic schema and tenant_id from request
        // Note: Schema variable must be used in template literal, not string interpolation in ON CONFLICT
        const result = await client.query(`
          INSERT INTO ${schema}.employees_cache (
            tenant_id, apollo_person_id, employee_name, employee_title, employee_email,
            employee_phone, employee_linkedin_url, employee_photo_url,
            employee_headline, employee_city, employee_state, employee_country,
            company_id, company_name, company_domain, data_source, employee_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (tenant_id, company_id, apollo_person_id) DO UPDATE SET
            employee_name = EXCLUDED.employee_name,
            employee_title = EXCLUDED.employee_title,
            employee_email = COALESCE(EXCLUDED.employee_email, employees_cache.employee_email),
            employee_phone = COALESCE(EXCLUDED.employee_phone, employees_cache.employee_phone),
            employee_linkedin_url = COALESCE(EXCLUDED.employee_linkedin_url, employees_cache.employee_linkedin_url),
            employee_photo_url = COALESCE(EXCLUDED.employee_photo_url, employees_cache.employee_photo_url),
            employee_headline = COALESCE(EXCLUDED.employee_headline, employees_cache.employee_headline),
            employee_city = COALESCE(EXCLUDED.employee_city, employees_cache.employee_city),
            employee_state = COALESCE(EXCLUDED.employee_state, employees_cache.employee_state),
            employee_country = COALESCE(EXCLUDED.employee_country, employees_cache.employee_country),
            company_name = COALESCE(EXCLUDED.company_name, employees_cache.company_name),
            company_domain = COALESCE(EXCLUDED.company_domain, employees_cache.company_domain),
            employee_data = EXCLUDED.employee_data,
            updated_at = NOW()
        `, [
          effectiveTenantId,
          apolloPersonId,
          emp.name || null,
          emp.title || null,
          emp.email || null,
          emp.phone || null,
          emp.linkedin_url || null,
          emp.photo_url || null,
          emp.headline || null,
          emp.city || null,
          emp.state || null,
          emp.country || null,
          emp.company_id || null,
          emp.company_name || null,
          emp.company_domain || null,
          'apollo_io', // data_source
          JSON.stringify(emp.employee_data || emp || {}) // employee_data is REQUIRED, ensure it's always an object
        ]);
        
        if (result.command === 'INSERT') {
          savedCount++;
        } else {
          updatedCount++;
        }
      } catch (saveError) {
        errorCount++;
        logger.warn('[Apollo Cache Save] Failed to save employee', {
          id: emp.id || emp.name,
          error: saveError.message
        });
        if (saveError.code === '23505') {
          // Unique constraint violation - this is okay, it means the record already exists
          logger.debug('[Apollo Cache Save] Record already exists, skipping');
        }
      }
    }
    
    logger.info('[Apollo Cache Save] Save operation completed', {
      saved: savedCount,
      updated: updatedCount,
      errors: errorCount,
      total: employees.length
    });
    
    return { savedCount, updatedCount, errorCount };
  } catch (saveError) {
    logger.error('[Apollo Cache Save] Error saving to cache', {
      message: saveError.message,
      stack: saveError.stack
    });
    throw saveError;
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Format Apollo employees for database storage
 */
function formatApolloEmployees(apolloEmployees) {
  return apolloEmployees.map(emp => ({
    id: emp.id || emp.person_id,
    name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
    title: emp.title || emp.job_title,
    email: emp.email || emp.work_email,
    phone: emp.phone_number || emp.phone,
    linkedin_url: emp.linkedin_url || emp.linkedin,
    photo_url: emp.photo_url || emp.photo,
    headline: emp.headline || emp.job_title,
    city: emp.city,
    state: emp.state,
    country: emp.country,
    company_id: emp.organization?.id || emp.company_id,
    company_name: emp.organization?.name || emp.company_name,
    company_domain: emp.organization?.domain || emp.company_domain,
    company_linkedin_url: emp.organization?.linkedin_url || emp.organization?.linkedin,
    company_website_url: emp.organization?.website_url || emp.organization?.website,
    employee_data: emp
  }));
}

module.exports = {
  saveEmployeesToCache,
  formatApolloEmployees
};

