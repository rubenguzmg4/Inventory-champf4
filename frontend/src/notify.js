import { notifications } from '@mantine/notifications';

export const notifySuccess = (message, title) => notifications.show({ color: 'teal', title, message });
export const notifyError = (error, title = 'No se pudo completar') =>
  notifications.show({ color: 'red', title, message: error?.message || String(error), autoClose: 7000 });
