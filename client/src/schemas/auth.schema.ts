import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Please enter a valid email address.")
    .max(254, "Email is too long."),
});

export const resetPasswordSchema = z
  .object({
    code: z.string().trim().min(1, "Reset code is required."),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long.")
      .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
      .regex(/[0-9]/, "Password must include at least one number.")
      .regex(/[^A-Za-z0-9]/, "Password must include at least one special character."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export interface Requirement {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: Requirement[] = [
  { id: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { id: "uppercase", label: "At least one uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { id: "number", label: "At least one number (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { id: "special", label: "At least one special character (!@#$%^&*)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export const getPasswordScore = (pw: string): number => {
  return PASSWORD_REQUIREMENTS.reduce((score, req) => (req.test(pw) ? score + 1 : score), 0);
};

