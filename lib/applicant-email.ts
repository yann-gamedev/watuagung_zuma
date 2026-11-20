export function maskApplicantEmail(email: string): string {
  const at = email.lastIndexOf("@");
  return `${[...email][0]}•••${email.slice(at)}`;
}
