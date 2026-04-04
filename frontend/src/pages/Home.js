import React, { useEffect, useState } from 'react';
import api from '../api/axios';

const Home = () => {
  const [services, setServices] = useState([]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await api.get('/services');
        setServices(res.data);
      } catch (error) {
        console.error('Ошибка загрузки услуг:', error);
      }
    };
    fetchServices();
  }, []);

  return (
    <div>
      <h1 style={{ textAlign: 'center', margin: '30px 0' }}>Наши строительные услуги</h1>
      <div className="card-grid">
        {services.length > 0 ? (
          services.map((service) => (
            <div className="card" key={service.id}>
              <h3>{service.name}</h3>
              <p>{service.description}</p>
            </div>
          ))
        ) : (
          <p style={{ textAlign: 'center', width: '100%' }}>Загрузка услуг...</p>
        )}
      </div>
    </div>
  );
};

export default Home;