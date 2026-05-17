import RolePermissionsForm from '@/components/RolePermissionsForm'
import { loadRolePermissions } from '@/lib/rolePermissions.server'
import { loadRoles } from '@/lib/roles.server'

export default async function PermissionsPage() {
  const [{ pages, sections, scopes }, roles] = await Promise.all([
    loadRolePermissions(),
    loadRoles(),
  ])
  return <RolePermissionsForm roles={roles} defaults={pages} sections={sections} scopes={scopes} />
}
