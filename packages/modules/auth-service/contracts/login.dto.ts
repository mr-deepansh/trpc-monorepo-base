import { z } from "zod";

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginDto = z.infer<typeof LoginDto>;
