export function invalidateGreeting() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("buddy-greeting");
  }
}
