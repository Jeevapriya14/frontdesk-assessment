
import axios from 'axios';


const baseURL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';


export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
