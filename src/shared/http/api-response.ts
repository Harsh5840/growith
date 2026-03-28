export const successResponse = (statusCode: number, message: string, data?: unknown) => ({
  success: true,
  statusCode,
  message,
  data,
});
