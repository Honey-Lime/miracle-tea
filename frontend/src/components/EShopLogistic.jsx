import { useState, useEffect, Fragment, useRef } from "react";
import ReactDadataBox from "react-dadata-box";
import './EShopLogistic.css';
// import ymapMarker from "../../src/source/ymap-market.png";

const EShopLogistic = ({ DADATA_TOKEN, ESHOPLOGISTIC_TOKEN, YANDEX_API_KEY }) => {
  // const [ip, setIp] = useState(null);

  const [data, setData] = useState({});
  const [services, setServices] = useState({});

  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedTerminal, setSelectedTerminal] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(false);
  // const [deliveryType, setDeliveryType] = useState('');
  const [addressPickMode, setAddressPickMode] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(null);
  const [lastCity, setLastCity] = useState(null);


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapLoad, setMapLoad] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const clustererRef = useRef(null);
  const addressPickModeRef = useRef(false);
  const deliveryAddressMarkerRef = useRef(null);
  const sourceReadyRef = useRef(false);




  // обработчик выбора города
  const handleCitySelect = (suggestion) => {
    if (!suggestion?.data) {
      setSelectedCity(null);
      return;
    }

    setLastCity(selectedCity?.fias);

    const lon = Number(suggestion.data.geo_lon);
    const lat = Number(suggestion.data.geo_lat);

    const cityData = {
      value: suggestion.value || suggestion.source,
      fias:
        suggestion.data.city_fias_id ||
        suggestion.data.settlement_fias_id ||
        suggestion.data.region_fias_id,
      lon,
      lat
    };


    if(addressPickMode) {
      setDeliveryAddress({
        address: suggestion.value,
        lon,
        lat
      });
    }

    setSelectedCity(cityData);
  };




  async function handleMapClick(coords) {
    const [lon, lat] = coords;
    const geocodeResult = await reverseGeocode(lon, lat);
    const address = geocodeResult?.address;

    if (!address) {
      console.log('Адрес не найден для координат:', { lon, lat });
      return;
    }

    const locationData = await getFiasByAddress(address);
    const nextFias = locationData?.fias;
    const nextLocationValue = locationData?.value;

    setDeliveryAddress({
      address,
      lon,
      lat
    });

    if (nextFias && nextFias !== selectedCity?.fias) {
      setLastCity(selectedCity?.fias || null);
      setSelectedCity({
        value: nextLocationValue || address,
        fias: nextFias,
        lon,
        lat
      });
    }

  }

  async function getFiasByAddress(address) {
    try {
      const response = await fetch(
        'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
        {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Token ' + DADATA_TOKEN
          },
          body: JSON.stringify({
            query: address,
            count: 1
          })
        }
      );

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      const suggestion = result.suggestions?.[0];

      return {
        fias:
          suggestion?.data?.city_fias_id ||
          suggestion?.data?.settlement_fias_id ||
          suggestion?.data?.region_fias_id ||
          null,
        value:
          suggestion?.data?.city_with_type ||
          suggestion?.data?.settlement_with_type ||
          suggestion?.data?.region_with_type ||
          suggestion?.value ||
          address
      };
    } catch (error) {
      console.error('Ошибка получения FIAS по адресу:', error);
      return null;
    }
  }

  function deleteDeliveryAddressMarker() {

    if (deliveryAddressMarkerRef.current) {
      mapInstanceRef.current.removeChild(deliveryAddressMarkerRef.current);
      deliveryAddressMarkerRef.current = null;
    }
    
  }

  function renderDeliveryAddressMarker(addressData) {
    if (!mapInstanceRef.current || !window.ymaps3 || !addressData || !sourceReadyRef.current) {
      return;
    }

    const { YMapMarker } = window.ymaps3;

    deleteDeliveryAddressMarker();

    const markerElement = document.createElement('div');
    markerElement.className = 'delivery-address-marker';

    deliveryAddressMarkerRef.current = new YMapMarker(
      {
        coordinates: [addressData.lon, addressData.lat],
        source: 'delivery-address-source'
      },
      markerElement
    );

    mapInstanceRef.current.addChild(deliveryAddressMarkerRef.current);
  }

  async function reverseGeocode(lon, lat) {
    const response = await fetch(
      `https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_API_KEY}&geocode=${lon},${lat}&format=json`
    );

    const data = await response.json();

    const geoObject = data.response.GeoObjectCollection.featureMember?.[0]?.GeoObject;
    const meta = geoObject?.metaDataProperty?.GeocoderMetaData;

    return {
      address: meta?.text || null
    };
  }







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
        console.error(`Ошибка ${dataKey}:  ${response.status}`, props);

        if (saveKey) {
          setData(prev => ({
            ...prev,
            [dataKey]: {
              ...prev[dataKey],
              [saveKey]: {}
            }
          }));
        }

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

      if (saveKey) {
        setData(prev => ({
          ...prev,
          [dataKey]: {
            ...prev[dataKey],
            [saveKey]: {}
          }
        }));
      }

      setError(err.message);
      return null;
    }
  }




  function createMarker(feature) {
    const { YMapMarker } = window.ymaps3;
    const terminal = feature.properties.terminal;

    const markerElement = document.createElement('img');
    markerElement.className = 'ymap-marker';
    markerElement.src = terminal.image;

    markerElement.onclick = (e) => {
      setSelectedTerminal(terminal);

      document.querySelectorAll('.ymap-marker').forEach((target) => {
        target.classList.remove('active');
      });

      e.currentTarget.classList.add('active');
    };

    return new YMapMarker(
      {
        coordinates: feature.geometry.coordinates,
        source: 'clusterer-source'
      },
      markerElement
    );
  }



  function createCluster(coordinates, features) {
    const { YMapMarker } = window.ymaps3;

    const clusterElement = document.createElement('div');
    clusterElement.className = 'ymap-cluster';
    clusterElement.textContent = features.length;

    return new YMapMarker(
      {
        coordinates,
        source: 'clusterer-source'
      },
      clusterElement
    );
  }




  function buildFeatures(calculation) {
    if (!calculation) return [];
    
    return Object.entries(calculation.data.terminals || {}).map(([idx, terminal]) => ({
      id: `${terminal.service}-${idx}`,
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(terminal.lon), Number(terminal.lat)]
      },
      properties: {
        terminal,
        service: terminal.service
      }
    }));
  }




  function changeDeliveryMethod(e, key, type) {
    document.querySelectorAll('.deliveryMethod').forEach(el => el.classList.remove('active'));
    e.currentTarget.classList.add('active');

    switch (type) {
      case 'terminal':
        setAddressPickMode(false);
        deleteDeliveryAddressMarker();
        break;
     
      case 'door':
        setAddressPickMode(true);
        if (!deliveryAddress && selectedCity) {
          setDeliveryAddress({
            address: selectedCity.value,
            lon: selectedCity.lon,
            lat: selectedCity.lat
          });
        }
        break;
    }

    setSelectedMethod({name: key, type: type});
  }

  function renderValue(value) {
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  useEffect(() => {
    addressPickModeRef.current = addressPickMode;
  }, [addressPickMode]);

  useEffect(() => {
    if (!mapReady || !deliveryAddress) {
      return;
    }

    renderDeliveryAddressMarker(deliveryAddress);
  }, [deliveryAddress, mapReady]);




  function handleDeliverySubmit() {
    console.log(deliveryAddress);
    console.log(selectedTerminal);
        
  }





  // function loadMarkers(src, lon, lat, callback) {
  //   const { YMapMarker, YMapClusterer, clusterByGrid } = window.ymaps3;
  //   // const { YMapClusterer, clusterByGrid } = await window.ymaps3.import('@yandex/ymaps3-clusterer@0.0.1');

  //   const clusterer = new YMapClusterer({
  //     method: clusterByGrid({ gridSize: 64 }),
  //     features,
  //     marker,
  //     cluster
  //   });

  //   mapInstanceRef.current.addChild(clusterer);
    
  //   const markerElement = document.createElement('img');
  //   markerElement.className = 'ymap-marker';
  //   markerElement.src = src;
  //   markerElement.onclick = (e) => callback(e);

  //   const marker = new YMapMarker(
  //     {
  //       coordinates: [lon, lat],
  //       // draggable: true,
  //       // mapFollowsOnDrag: true
  //     },
  //     markerElement
  //   );
  //   mapInstanceRef.current.addChild(marker);
  // }
















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

    if (!selectedCity?.fias || !selectedCity?.value || !Object.keys(services).length) {
      return;
    }    

    if(lastCity !== selectedCity) {
      Object.keys(services).forEach((service) => {
        customFetch("/delivery/calculation", {to: selectedCity.fias, weight: 1, service: service, address: selectedCity.value}, service);
      });
    }

  }, [selectedCity, services]);



  // центруем карту на городе
  useEffect(() => {
    if (!mapLoad || !mapInstanceRef.current || !selectedCity) {
      return;
    }

    const lon = Number(selectedCity.lon);
    const lat = Number(selectedCity.lat);

    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return;
    }
    if(mapLoad && data.state) {
      mapInstanceRef.current.setLocation({
        center: [lon, lat]
      });
    }
  }, [selectedCity, mapLoad, data.state]);




  // выгружаем на карту точки
  useEffect(() => {
    if (!mapLoad || !mapReady || !data.calculation || !mapInstanceRef.current || !window.ymaps3 || !selectedMethod) {
      return;
    }

    const initClusterer = async () => {

      setSelectedTerminal(null);

      const { YMapClusterer, clusterByGrid } =
        await window.ymaps3.import('@yandex/ymaps3-clusterer@0.0.1');

      const calculation = data.calculation[selectedMethod.name];
      if (!calculation?.data?.terminals) {
        return;
      }

      const features = buildFeatures(calculation);

      if (clustererRef.current) {
        mapInstanceRef.current.removeChild(clustererRef.current);
        clustererRef.current = null;
      }

      clustererRef.current = new YMapClusterer({
        method: clusterByGrid({ gridSize: 128 }),
        features,
        marker: createMarker,
        cluster: createCluster
      });

      mapInstanceRef.current.addChild(clustererRef.current);
    }

    
    const initPointer = async () => {

      setSelectedTerminal(null);

      if (clustererRef.current) {
        mapInstanceRef.current.removeChild(clustererRef.current);
        clustererRef.current = null;
      }
    }

    
    if (selectedMethod.type === 'terminal') { initClusterer(); }
    if (selectedMethod.type === 'door') { initPointer(); }

  }, [mapLoad, mapReady, selectedMethod, data.calculation]);




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

    setMapReady(false);
    sourceReadyRef.current = false;

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
        ymaps3.import.registerCdn(
          'https://cdn.jsdelivr.net/npm/{package}',
          '@yandex/ymaps3-default-ui-theme@latest'
        );

        if (cancelled || !mapRef.current) return;


        const { 
          YMap, 
          YMapDefaultSchemeLayer, 
          YMapDefaultFeaturesLayer, 
          YMapFeatureDataSource,
          YMapLayer,
          YMapMarker, 
          YMapClusterer, 
          clusterByGrid,
          YMapListener
        } = window.ymaps3;
        const { YMapControls } = window.ymaps3;
        const { YMapZoomControl } = await window.ymaps3.import('@yandex/ymaps3-default-ui-theme');

        const LOCATION = {
          center: [37.588144, 55.733842],
          zoom: 9
        };

        mapInstanceRef.current = new YMap(mapRef.current, {
          location: LOCATION,
        });

        const controls = new YMapControls(
          { position: 'right', orientation: 'vertical' },
          [
            new YMapZoomControl({ easing: 'linear' })
          ]
        );

        const mapListener = new YMapListener({
          layer: 'any',
          onClick: (object, event) => {
            if (!addressPickModeRef.current) return;

            // console.log('coords:', event.coordinates);
            handleMapClick(event.coordinates);
          }
        });

        mapInstanceRef.current
        .addChild(
          new YMapDefaultSchemeLayer())
        .addChild(
          new YMapDefaultFeaturesLayer())
        .addChild(
          new YMapFeatureDataSource({ id: 'clusterer-source' }))
        .addChild(
          new YMapLayer({ source: 'clusterer-source', type: 'markers', zIndex: 1800 }))
        .addChild(
          new YMapFeatureDataSource({ id: 'delivery-address-source' }))
        .addChild(
          new YMapLayer({ source: 'delivery-address-source', type: 'markers', zIndex: 1900 }))
        .addChild(
          controls)
        .addChild(mapListener);


        sourceReadyRef.current = true;

        setMapReady(true);


        setMapLoad(true);

      } catch (err) {
        console.error("Ошибка загрузки Яндекс.Карт:", err);
      }
    };

    initMap();

    return () => {
      cancelled = true;

      setMapReady(false);
      sourceReadyRef.current = false;

      deliveryAddressMarkerRef.current = null;

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
          query={deliveryAddress?.address || selectedCity?.value || ''}
        />



      
        {addressPickMode && (<div>Выберите адрес на карте / Найдите в строке поиска</div>)}

        <div className="deliveryInfo">
          <div id={'ymap'} ref={mapRef}></div>
          <ul className="pointInfo">
            {selectedTerminal && <>
              <li><img src={selectedTerminal.image} alt={selectedTerminal.service} /></li>
              <li>{selectedTerminal.is_postamat ? 'Постамат' : 'Пункт выдачи'}</li>
              <li>{renderValue(selectedTerminal.address)}</li>
              <li>{renderValue(selectedTerminal.workTime)}</li>
              <li>Номер: {Array.isArray(selectedTerminal.phones) ? selectedTerminal.phones.join(', ') : renderValue(selectedTerminal.phones)}</li>
              <q>{renderValue(selectedTerminal.note)}</q>
              <li>Оплата: {renderValue(selectedTerminal.payment?.possible)}</li>
              <li>Методы оплаты: {Array.isArray(selectedTerminal.payment?.methods) ? selectedTerminal.payment.methods.join(', ') : renderValue(selectedTerminal.payment?.methods)}</li>
              {/* <li>Цена: {selectedTerminal.price?.value} {selectedTerminal.price?.unit}</li>
              <li>Сроки: {selectedTerminal.time?.value} {selectedTerminal.time?.unit}</li> */}

            </>}
            {addressPickMode && deliveryAddress && (
              <>
                <li><img src={services[selectedMethod.name].logo} alt={selectedMethod.name} /></li>
                <li>{services[selectedMethod.name].name}</li>
                <li>{deliveryAddress.address}</li>
                {/* <li>{data.calculation[selectedMethod.name].data.door?.price?.value} {data.calculation[selectedMethod.name].data.door?.price?.unit}</li>
                <li>{data.calculation[selectedMethod.name].data.door?.time?.value} {data.calculation[selectedMethod.name].data.door?.time?.unit}</li> */}
              </>
            )}
            {(selectedTerminal || (addressPickMode && deliveryAddress)) && (
              <div className="submitDeliveryButton" onClick={() => {handleDeliverySubmit()}}>Подтвердить адрес доставки</div>
            )}
          </ul>
        </div>
        
        {data.calculation && 
        <div className="deliverySettings">

          {/* <b>{selectedTerminal}</b> */}

          <ul className="deliveryCalculation">
            {Object.entries(data.calculation).map(([serviceKey, body]) => (
              // Для каждого сервиса создаём свою секцию (или просто группу элементов)
              <Fragment key={serviceKey}>
                {body?.data?.terminal && (
                  <li className="deliveryMethod" onClick={(e) => {
                    changeDeliveryMethod(e, serviceKey, 'terminal');
                    }}>
                    <span>{data.state.data.services[serviceKey].name} до пункта выдачи: {body?.data?.terminal?.price?.value} {body?.data?.terminal?.price?.unit} - {body?.data?.terminal?.time?.value} {body?.data?.terminal?.time?.unit}</span>
                  </li>
                )}

                {body?.data?.door && (
                  <li className="deliveryMethod" onClick={(e) => {
                    changeDeliveryMethod(e, serviceKey, 'door');
                    }}>
                    <span>{data.state.data.services[serviceKey].name} курьером: {body?.data?.door?.price?.value} {body?.data?.door?.price?.unit} - {body?.data?.door?.time?.value} {body?.data?.door?.time?.unit}</span>
                  </li>
                )}
              </Fragment>
            ))}
          </ul>

        </div>}


      </>}
    </div>
  );
};

export default EShopLogistic;
