// localhost:3000/api

import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';


// Use 10.0.2.2 for Android Emulator
// Use your machine's local IP (e.g., 192.168.1.x) for physical device
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

const api= axios.create({
    baseURL: API_URL,
    headers:{
        "Content-Type": "application/json",
    },
});


export const useApi = () => {
    const {getToken} = useAuth();

    useEffect(() => {
        const interceptor = api.interceptors.request.use(async (config) => {
            console.log("Interceptor running for:", config.url);
            const token = await getToken();
            console.log("Token retrieved:", !!token);
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        return () => {
            api.interceptors.request.eject(interceptor);
        }
    }, [getToken]);

    return api;

}


