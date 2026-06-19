import { loginAttempts, loginFailures } from "@repo/observability";
import { LoginDto } from "../contracts/login.dto";

export async function login(input: LoginDto) {
  loginAttempts.inc();
}
