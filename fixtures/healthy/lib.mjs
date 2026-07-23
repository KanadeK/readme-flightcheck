export function greeting(name) {
  if (!name.trim()) {
    throw new Error('name is required');
  }
  return `README ready, ${name}.`;
}
