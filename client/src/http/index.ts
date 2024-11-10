import axios from "axios";
import { AuthResponce } from "../models/responce/AuthResponse";
export const API_URL = 'http://localhost:5000'

const $api = axios.create({ 
  withCredentials: true,
  baseURL: API_URL
})

$api.interceptors.request.use((config) => { 
  config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`
  return config
})

$api.interceptors.response.use((config) => { 
  return config
}, async (error) => {
  const originalRequest = error.config
  if(error.response.status == 401 && error.config && !error.config.isRetry == true) { 
    originalRequest.isRetry = true
    try { 
      const response = await axios.get<AuthResponce>(`${API_URL}/auth/refresh`, {withCredentials: true})
      localStorage.setItem('token', response.data.accessToken)
      return $api.request(originalRequest)
    } catch(e) { 
      console.log('Не авторизован')
    }
  }
  throw error
})


export default $api