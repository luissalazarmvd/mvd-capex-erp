export async function logoutAndReturnToPortal() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  }).catch(() => undefined);

  window.location.replace("/");
}
