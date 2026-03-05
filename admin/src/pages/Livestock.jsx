import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '../lib/axios';

const Livestock = () => {
    const {data: animals, isLoading, error} = useQuery({
        queryKey: ["animals"],
        queryFn: async () => {
            const res = await axios.get("/animals/all");
            return res.data;
        }
    });
    return (
        <div className="p-6">
            {isLoading && <p>Loading...</p>}
            {error && <p>Error: {error.message}</p>}
            {animals && (
                <ul>
                    {animals.map((animal) => (
                        <li key={animal._id}>{animal.earTag} {animal.species} {animal.breed} {animal.color}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default Livestock;
