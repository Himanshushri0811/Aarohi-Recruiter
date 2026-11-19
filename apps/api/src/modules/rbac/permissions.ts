export const Permission = {
  ORG_READ: 'org:read',
  ORG_UPDATE: 'org:update',
  ORG_DELETE: 'org:delete',
  ORG_MANAGE_MEMBERS: 'org:manage_members',
  USER_READ: 'user:read',
  USER_INVITE: 'user:invite',
  USER_REMOVE: 'user:remove',
  INTERVIEW_CREATE: 'interview:create',
  INTERVIEW_READ: 'interview:read',
  INTERVIEW_UPDATE: 'interview:update',
  INTERVIEW_DELETE: 'interview:delete',
  INTERVIEW_CONDUCT: 'interview:conduct',
  ADMIN_ALL: 'admin:all',
  // Job permissions
  JOB_CREATE: 'job:create',
  JOB_READ: 'job:read',
  JOB_UPDATE: 'job:update',
  JOB_DELETE: 'job:delete',
  // Candidate permissions
  CANDIDATE_CREATE: 'candidate:create',
  CANDIDATE_READ: 'candidate:read',
  CANDIDATE_UPDATE: 'candidate:update',
  CANDIDATE_DELETE: 'candidate:delete',
  // Resume permissions
  RESUME_UPLOAD: 'resume:upload',
  RESUME_READ: 'resume:read',
  RESUME_DELETE: 'resume:delete',
  RESUME_ANALYZE: 'resume:analyze',
  // Application permissions
  APPLICATION_CREATE: 'application:create',
  APPLICATION_READ: 'application:read',
  APPLICATION_UPDATE: 'application:update',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [Permission.ADMIN_ALL],
  OWNER: [
    Permission.ADMIN_ALL,
    Permission.ORG_READ,
    Permission.ORG_UPDATE,
    Permission.ORG_DELETE,
    Permission.ORG_MANAGE_MEMBERS,
    Permission.USER_READ,
    Permission.USER_INVITE,
    Permission.USER_REMOVE,
    Permission.INTERVIEW_CREATE,
    Permission.INTERVIEW_READ,
    Permission.INTERVIEW_UPDATE,
    Permission.INTERVIEW_DELETE,
    Permission.INTERVIEW_CONDUCT,
    // Job permissions
    Permission.JOB_CREATE,
    Permission.JOB_READ,
    Permission.JOB_UPDATE,
    Permission.JOB_DELETE,
    // Candidate permissions
    Permission.CANDIDATE_CREATE,
    Permission.CANDIDATE_READ,
    Permission.CANDIDATE_UPDATE,
    Permission.CANDIDATE_DELETE,
    // Resume permissions
    Permission.RESUME_UPLOAD,
    Permission.RESUME_READ,
    Permission.RESUME_DELETE,
    Permission.RESUME_ANALYZE,
    // Application permissions
    Permission.APPLICATION_CREATE,
    Permission.APPLICATION_READ,
    Permission.APPLICATION_UPDATE,
  ],
  ORGANIZATION_ADMIN: [
    Permission.ADMIN_ALL,
    Permission.ORG_READ,
    Permission.ORG_UPDATE,
    Permission.ORG_DELETE,
    Permission.ORG_MANAGE_MEMBERS,
    Permission.USER_READ,
    Permission.USER_INVITE,
    Permission.USER_REMOVE,
    Permission.INTERVIEW_CREATE,
    Permission.INTERVIEW_READ,
    Permission.INTERVIEW_UPDATE,
    Permission.INTERVIEW_DELETE,
    Permission.INTERVIEW_CONDUCT,
    // Job permissions
    Permission.JOB_CREATE,
    Permission.JOB_READ,
    Permission.JOB_UPDATE,
    Permission.JOB_DELETE,
    // Candidate permissions
    Permission.CANDIDATE_CREATE,
    Permission.CANDIDATE_READ,
    Permission.CANDIDATE_UPDATE,
    Permission.CANDIDATE_DELETE,
    // Resume permissions
    Permission.RESUME_UPLOAD,
    Permission.RESUME_READ,
    Permission.RESUME_DELETE,
    Permission.RESUME_ANALYZE,
    // Application permissions
    Permission.APPLICATION_CREATE,
    Permission.APPLICATION_READ,
    Permission.APPLICATION_UPDATE,
  ],
  ADMIN: [
    Permission.ORG_READ,
    Permission.ORG_UPDATE,
    Permission.ORG_MANAGE_MEMBERS,
    Permission.USER_READ,
    Permission.USER_INVITE,
    Permission.USER_REMOVE,
    Permission.INTERVIEW_CREATE,
    Permission.INTERVIEW_READ,
    Permission.INTERVIEW_UPDATE,
    Permission.INTERVIEW_DELETE,
    Permission.INTERVIEW_CONDUCT,
    // Job permissions
    Permission.JOB_CREATE,
    Permission.JOB_READ,
    Permission.JOB_UPDATE,
    Permission.JOB_DELETE,
    // Candidate permissions
    Permission.CANDIDATE_CREATE,
    Permission.CANDIDATE_READ,
    Permission.CANDIDATE_UPDATE,
    Permission.CANDIDATE_DELETE,
    // Resume permissions
    Permission.RESUME_UPLOAD,
    Permission.RESUME_READ,
    Permission.RESUME_DELETE,
    Permission.RESUME_ANALYZE,
    // Application permissions
    Permission.APPLICATION_CREATE,
    Permission.APPLICATION_READ,
    Permission.APPLICATION_UPDATE,
  ],
  RECRUITER: [
    Permission.ORG_READ,
    Permission.USER_READ,
    Permission.INTERVIEW_CREATE,
    Permission.INTERVIEW_READ,
    Permission.INTERVIEW_UPDATE,
    Permission.INTERVIEW_CONDUCT,
    // Job permissions (create/read/update, no delete)
    Permission.JOB_CREATE,
    Permission.JOB_READ,
    Permission.JOB_UPDATE,
    // Candidate permissions (create/read/update)
    Permission.CANDIDATE_CREATE,
    Permission.CANDIDATE_READ,
    Permission.CANDIDATE_UPDATE,
    // Resume permissions
    Permission.RESUME_UPLOAD,
    Permission.RESUME_READ,
    Permission.RESUME_DELETE,
    Permission.RESUME_ANALYZE,
    // Application permissions (create/read/update)
    Permission.APPLICATION_CREATE,
    Permission.APPLICATION_READ,
    Permission.APPLICATION_UPDATE,
  ],
  VIEWER: [
    Permission.ORG_READ,
    Permission.USER_READ,
    Permission.INTERVIEW_READ,
    Permission.INTERVIEW_CONDUCT,
    // Read-only permissions
    Permission.JOB_READ,
    Permission.CANDIDATE_READ,
    Permission.RESUME_READ,
    Permission.APPLICATION_READ,
  ],
  INTERVIEWER: [
    Permission.ORG_READ,
    Permission.USER_READ,
    Permission.INTERVIEW_READ,
    Permission.INTERVIEW_CONDUCT,
    // Read-only permissions
    Permission.JOB_READ,
    Permission.CANDIDATE_READ,
    Permission.RESUME_READ,
    Permission.APPLICATION_READ,
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return (
    perms.includes(Permission.ADMIN_ALL as Permission) || perms.includes(permission)
  );
}
