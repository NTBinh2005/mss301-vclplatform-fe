import { http } from '../api/client';
import type { ApiResponse, PublicStats } from '../models';
import { unwrap } from './shared';

/* =====================  public  ===================== */
export const publicApi = {
  stats: () => unwrap(http.get<ApiResponse<PublicStats>>('/public/stats')),
  trackVisit: () => {
    let sid = sessionStorage.getItem('visit_session_id');
    if (!sid) {
      sid = crypto.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('visit_session_id', sid);
    }
    return http.post('/visits/track', null, { headers: { 'X-Visit-Session': sid } });
  },
};
