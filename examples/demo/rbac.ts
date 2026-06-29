import { defineRbac, presets } from "@blawness/admin-kit/rbac";

export const rbac = defineRbac({
  roles: {
    ...presets.adminEditor, // admin + editor
    author: presets.permissions.articleAuthor,
  },
  fallbackRole: "editor",
  protectedPermission: "users.delete",
});
