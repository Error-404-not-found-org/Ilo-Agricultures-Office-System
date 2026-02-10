// localhost:3000/api

import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';


const API_URL = "http://localhost:3000/api";

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
            const token = await getToken();
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

// on every sigle reg, we would like to have a auth token so that our backend knows were authenticated
