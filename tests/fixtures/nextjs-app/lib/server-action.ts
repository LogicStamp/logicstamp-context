'use server';

export async function submitForm(data: FormData) {
  // Server-only code
  const name = data.get('name');
  console.log('Processing:', name);
  return { success: true };
}
