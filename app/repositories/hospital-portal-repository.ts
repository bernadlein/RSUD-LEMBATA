import type { SupabaseClient } from '@supabase/supabase-js'
import { portalDraftSchema, emptyPortalDraft, type PortalDraft, type PortalState } from '../domain/hospital-portal'
import { attendanceLocationSchema, type AttendanceLocation, type AttendanceLocationInput } from '../domain/geolocation'

function fail(error: { code?: string; message: string } | null) {
  if (!error) return
  if (['42P01', 'PGRST202', 'PGRST205'].includes(error.code ?? '')) throw new Error('Layanan portal dan lokasi belum tersedia.')
  throw new Error(error.message)
}
export class HospitalPortalRepository {
  constructor(private client: SupabaseClient) {}
  async load(workspaceId: string): Promise<PortalState> {
    const [draft, publication] = await Promise.all([
      this.client.from('rd_portal_drafts').select('data,revision').eq('workspace_id', workspaceId).maybeSingle(),
      this.client.from('rd_portal_publications').select('published_at').eq('workspace_id', workspaceId).maybeSingle(),
    ])
    fail(draft.error); fail(publication.error)
    return { data: draft.data ? portalDraftSchema.parse(draft.data.data) : emptyPortalDraft(), revision: draft.data?.revision ?? 0, publishedAt: publication.data?.published_at ?? null }
  }
  async save(workspaceId: string, draft: PortalDraft, revision: number): Promise<number> {
    const { data, error } = await this.client.rpc('rd_save_portal_draft', { p_workspace_id: workspaceId, p_data: portalDraftSchema.parse(draft), p_expected_revision: revision })
    fail(error)
    if (!Number.isInteger(data)) throw new Error('Versi draf portal belum valid.')
    return data as number
  }
  async publish(workspaceId: string, revision: number): Promise<string> {
    const { data: auth } = await this.client.auth.getSession()
    if (!auth.session) throw new Error('Masuk kembali sebelum menerbitkan informasi.')
    const response = await fetch('/api/portal', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth.session.access_token },
      body: JSON.stringify({ workspaceId, draftRevision: revision }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.statusMessage ?? result.message ?? 'Informasi belum diterbitkan.')
    return result.publishedAt
  }
  async unpublish(workspaceId: string) {
    const { error } = await this.client.rpc('rd_unpublish_hospital_portal', { p_workspace_id: workspaceId }); fail(error)
  }
  async location(workspaceId: string): Promise<AttendanceLocation | null> {
    const { data, error } = await this.client.from('rd_attendance_locations').select('workspace_id,latitude,longitude,radius_meters,max_accuracy_meters,revision').eq('workspace_id', workspaceId).maybeSingle()
    fail(error)
    return data ? attendanceLocationSchema.parse(data) : null
  }
  async saveLocation(workspaceId: string, location: AttendanceLocationInput, revision: number): Promise<AttendanceLocation> {
    const parsed = attendanceLocationSchema.parse({ ...location, workspace_id: workspaceId, revision })
    const { data, error } = await this.client.rpc('rd_save_attendance_location', {
      p_workspace_id: workspaceId, p_latitude: parsed.latitude, p_longitude: parsed.longitude,
      p_radius_meters: parsed.radius_meters, p_max_accuracy_meters: parsed.max_accuracy_meters, p_expected_revision: revision,
    })
    fail(error)
    return attendanceLocationSchema.parse(data)
  }
}
