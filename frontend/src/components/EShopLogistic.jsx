import { useState, useEffect, Fragment, useRef } from "react";
import ReactDadataBox from "react-dadata-box";
import './EShopLogistic.css';
import ymapMarker from "../../src/source/ymap-market.png";

const EShopLogistic = ({ DADATA_TOKEN, ESHOPLOGISTIC_TOKEN, YANDEX_API_KEY }) => {
  // const [ip, setIp] = useState(null);

  const [data, setData] = useState({});
  const [services, setServices] = useState({});

  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedService, setSelectedService] = useState('Выберите способ доставки');
  // const [deliveryType, setDeliveryType] = useState('');

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapLoad, setMapLoad] = useState(false);




  // обработчик выбора города
  const handleCitySelect = (suggestion) => {

    // Из выбранной подсказки извлекаем нужные данные
    const cityData = {
      value: suggestion.value,
      fias: suggestion.data.city_fias_id, // ФИАС-код города
      lon: suggestion.data.geo_lon,
      lat: suggestion.data.geo_lat
    };

    setSelectedCity(cityData);
    // console.log("Выбран город:", cityData);
    console.log(suggestion.data);

  };




  // обертка запроса к API
  async function customFetch(api, props = {}, saveKey = false) {
    try {

      let dataKey = api.split('/');
      dataKey = dataKey[dataKey.length - 1];

      const response = await fetch("https://api.esplc.ru" + api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: ESHOPLOGISTIC_TOKEN, ...props }),
      });

      if (!response.ok) {
        console.error(`Ошибка ${dataKey}:  ${response.status}`);
        return;
      }

      const json = await response.json();
      if(saveKey) {

        setData(prev => ({
          ...prev,
          [dataKey]: {
            ...prev[dataKey],
            [saveKey]: json
          }
        }));

      } else {

        setData(prev => ({
          ...prev,
          [dataKey]: json
        }));

      }

      return 'ok';

    } catch (err) {
      console.error(`Network error ${api}:`, err);
      setError(err.message);
      return null;
    }
  }



  function createMarker(src, lon, lat, callback) {
    const { YMapMarker } = window.ymaps3;

    const markerElement = document.createElement('img');
    markerElement.className = 'ymap-marker';
    markerElement.src = src;
    markerElement.onclick = () => callback();

    const marker = new YMapMarker(
      {
        coordinates: [lon, lat],
        // draggable: true,
        // mapFollowsOnDrag: true
      },
      markerElement
    );
    mapInstanceRef.current.addChild(marker);
  }
















  // фетчим основные запросы
  useEffect(() => {

    setLoading(true);
    customFetch("/client/state");
    
    fetch("https://api.ipify.org?format=json")
      .then(res => res.json())
      .then(data => data.ip)
      .then(ip => {

        fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/iplocate/address", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": "Token " + DADATA_TOKEN
          },
          body: JSON.stringify({ ip: ip }),
        })
        .then(res => res.json())
        .then(data => {

          handleCitySelect(data.location);

        })
        .catch(error => console.error("error", error));

      })
      .catch(err => {
        setError(err.message);
      });

  }, []);




  // получаем список доставщиков
  useEffect(() => {
    if (data.state) {

      setServices(data.state.data.services);

    }
  }, [data.state]);




  // фетчим сервисы доставки
  useEffect(() => {

    if (selectedCity && services) {
      
      Object.keys(services).forEach((service) => {
        customFetch("/delivery/calculation", {to: selectedCity.fias, weight: 1, service: service, address: selectedCity.value}, service);
      });

    }

  }, [selectedCity, services]);



  // центруем карту на городе
  useEffect(() => {
    if(mapLoad && data.state) {
      mapInstanceRef.current.setLocation({
        center: [selectedCity.lon, selectedCity.lat],
        zoom: 12,
      });
    }
  }, [selectedCity]);



  // выгружаем на карту точки
  useEffect(() => {
    if(mapLoad && data.calculation) {
      Object.entries(data.calculation).map(([serviceKey, body]) => {
        Object.entries(body.data.terminals).map(([idx, terminal]) => {
          createMarker(terminal.image, terminal.lon, terminal.lat, () => setSelectedService(terminal.code));
        })
      });
    }    
  }, [data.calculation, mapLoad]);




  // снимаем загрузку
  useEffect(() => {

    // проверяем что все подгрузилось
    if (data.state) {
      setLoading(false);
    }

  }, [data.state]);
  













  
  // подключаем яндекс карту
  useEffect(() => {
    if(loading) {
      return;
    }

    let cancelled = false;

    const loadYandexMapsScript = () =>
      new Promise((resolve, reject) => {
        if (window.ymaps3) {
          resolve();
          return;
        }

        const existingScript = document.querySelector(
          'script[src^="https://api-maps.yandex.ru/v3/"]'
        );

        if (existingScript) {
          existingScript.addEventListener("load", resolve, { once: true });
          existingScript.addEventListener("error", reject, { once: true });
          return;
        }

        const scriptElement = document.createElement("script");
        scriptElement.src = `https://api-maps.yandex.ru/v3/?apikey=${YANDEX_API_KEY}&lang=ru_RU`;
        scriptElement.async = true;
        scriptElement.onload = resolve;
        scriptElement.onerror = reject;
        document.head.appendChild(scriptElement);
      });

    const initMap = async () => {
      try {
        await loadYandexMapsScript();
        await window.ymaps3.ready;

        if (cancelled || !mapRef.current) return;

        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = window.ymaps3;

        const LOCATION = {
          center: [37.588144, 55.733842],
          zoom: 9
        };

        mapInstanceRef.current = new YMap(mapRef.current, {
          location: LOCATION,
        });

        mapInstanceRef.current.addChild(new YMapDefaultSchemeLayer());
        mapInstanceRef.current.addChild(new YMapDefaultFeaturesLayer());

        setMapLoad(true);

      } catch (err) {
        console.error("Ошибка загрузки Яндекс.Карт:", err);
      }
    };

    initMap();

    return () => {
      cancelled = true;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
      }
    };
  }, [loading]);
  















  return (
    <div className="EShopLogistic">

      {loading && <div>Загрузка...</div>}
      {error && <div>Ошибка: {error}</div>}
      {!loading && <>

        <ReactDadataBox
          token={DADATA_TOKEN}
          type="address"
          onChange={handleCitySelect}
          placeholder="Введите город / Адрес доставки..."
          query={selectedCity?.value}
        />

        <div ref={mapRef} style={{ width: "80%", height: "50vh", padding: "20px", margin: 'auto' }}></div>

        {/* <b>{Object.keys(data).join(', ')}</b> */}



        {/* <pre>{JSON.stringify(data.state.data.services, null, 2)}</pre> */}
        {selectedCity && (
          <div style={{ marginTop: "10px" }}>
            Код ФИАС: <code>{selectedCity.fias}</code> <br />
          </div>
        )}

        {data.calculation && 
        <div className="deliverySettings">

          <b>{selectedService}</b>

          <ul className="deliveryCalculation">
            {Object.entries(data.calculation).map(([serviceKey, body]) => (
              // Для каждого сервиса создаём свою секцию (или просто группу элементов)
              
              <Fragment key={serviceKey}>

                {/* <pre>{Object.keys(body.data).join(', ')}</pre> */}

                <li>{data.state.data.services[serviceKey].name} до пункта выдачи: {body.data.terminal.price.value + ' ' + body.data.terminal.price.unit} - {body.data.terminal.time.value + ' ' + body.data.terminal.time.unit}</li>
                <li>{data.state.data.services[serviceKey].name} курьером: {body.data.door.price.value + ' ' + body.data.door.price.unit} - {body.data.door.time.value + ' ' + body.data.door.time.unit}</li>

                {Object.entries(body.data.terminals).map(([idx, terminal]) => (
                  <pre key={`${serviceKey}-${idx}`}>

                    {/* {idx}: {JSON.stringify(terminal, null, 2)} */}

                  </pre>
                ))}
              </Fragment>
            ))}
          </ul>

          {/* <pre>{JSON.stringify(data.calculation.sdek, null, 2)}</pre>
          <pre>{JSON.stringify(data.calculation.yandex, null, 2)}</pre> */}

        </div>}
      </>}
    </div>
  );
};

export default EShopLogistic;
