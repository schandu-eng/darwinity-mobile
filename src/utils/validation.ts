export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return cleaned.length >= 10 && phoneRegex.test(phone);
};
