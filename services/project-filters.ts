import 'server-only';
import {and,eq,ilike,sql} from 'drizzle-orm';
import {projectVersions as v} from '../db/schema';
import {projectProvinceFilterAliases} from '../lib/projects/locations';
import {type projectQuery} from '../lib/projects/query';
export function projectFieldFilters(q:Pick<ReturnType<typeof projectQuery>,'category'|'province'|'stage'|'minPrice'|'maxPrice'>){return and(q.category?eq(v.category,q.category):undefined,q.province?sql`(${sql.join(projectProvinceFilterAliases(q.province).map(alias=>ilike(v.provinceCode,alias.replace(/[\\%_]/g,'\\$&'))),sql` OR `)})`:undefined,q.stage?ilike(v.projectStage,q.stage.replace(/[\\%_]/g,'\\$&')):undefined,q.minPrice?sql`${v.pricePoints}>=${q.minPrice}::bigint`:undefined,q.maxPrice?sql`${v.pricePoints}<=${q.maxPrice}::bigint`:undefined);}
