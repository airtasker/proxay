export const PROXAY_PORT = parseInt(process.env.PROXAY_PORT!) || 4000;
export const TEST_SERVER_PORT = parseInt(process.env.TEST_SERVER_PORT!) || 4001;

export const PROXAY_HOST = `http://localhost:${PROXAY_PORT}`;
export const TEST_SERVER_HOST = `http://localhost:${TEST_SERVER_PORT}`;
