export type Role = "user" | "operator" | "admin";

export const ROLE_LABELS: Record<Role, string> = {
  user: "کاربر",
  operator: "اپراتور",
  admin: "مدیر",
};

export const ALL_ROLES: Role[] = ["user", "operator", "admin"];
