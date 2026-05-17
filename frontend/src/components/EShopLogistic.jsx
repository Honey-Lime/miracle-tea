import { useContext, useState, useEffect } from "react";
import ReactDadataBox from "react-dadata-box";

const EShopLogistic = ({ DADATA_TOKEN, ESHOPLOGISTIC_TOKEN }) => {
  // const [ip, setIp] = useState(null);

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCity, setSelectedCity] = useState(null);
  const [services, setServices] = useState({});
  const [deliveryService, setDeliveryService] = useState('');
  const [deliveryType, setDeliveryType] = useState('');

  // обработчик выбора города
  const handleCitySelect = (suggestion) => {

    // Из выбранной подсказки извлекаем нужные данные
    const cityData = {
      value: suggestion.value,
      fias: suggestion.data.city_fias, // ФИАС-код города
      region: suggestion.data.region_with_type,
    };

    setSelectedCity(cityData);
    console.log("Выбран город:", cityData);

  };




  // обертка запроса к API
  async function customFetch(api, props = {}, saveKey = false) {

    let dataKey = api.split('/');
    dataKey = dataKey[dataKey.length - 1];

    const response = await fetch("https://api.esplc.ru" + api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: ESHOPLOGISTIC_TOKEN, ...props }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка: ${response.status}`);
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
  }




  // фетчим основные запросы
  useEffect(() => {

    setLoading(true);
    customFetch("/client/state");
    // customFetch("/delivery/info");
    
    fetch("https://api.ipify.org?format=json")
      .then(res => res.json())
      .then(data => data.ip)
      .then(ip => {
        customFetch("/locality/geo", {ip: ip});
      })
      .catch(err => {
        setError(err.message);
      })

  }, []);


  // получаем список доставщиков
  useEffect(() => {

    if (data.state) {
      setServices(data.state.data.services);
    }

  }, [data.state]);


  // получаем город из гео
  useEffect(() => {

    // записываем город из геопоиска
    if(data.geo) {
      const cityData = {
        value: data.geo.data.name,
        fias: data.geo.data.fias, // ФИАС-код города
        region: data.geo.data.region,
      };
      setSelectedCity(cityData);
    }

  }, [data.geo]);


  // фетчим сервисы доставки
  useEffect(() => {

    if (selectedCity && services) {
      // console.log(selectedCity.fias);
      // console.log(services);
      // console.log();
      
      Object.keys(services).forEach((service) => {
        // if(service != 'yandex') {
          customFetch("/delivery/calculation", {to: selectedCity.fias, weight: 1, dimensions: '10*10*10', service: service, cache: false}, service);
        // }
      });

      // customFetch("/delivery/calculation", {to: selectedCity.fias, weight: 1, service: 'yandex'}, 'yandex');
    }

  }, [selectedCity, services]);


  // снимаем загрузку
  useEffect(() => {

    // проверяем что все подгрузилось
    if (data.calculation) {
      setLoading(false);
    }

  }, [data.calculation]);




  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;

  return (
    <div className="EShopLogistic">
      {/* <b>{Object.keys(data).join(', ')}</b> */}
      {/* <pre>{JSON.stringify(data.state.data.services, null, 2)}</pre> */}

      <ReactDadataBox
        token={DADATA_TOKEN}
        type="address"
        onChange={handleCitySelect}
        placeholder="Введите город/Точный адрес..."
        query={data.geo.data.name}
      />

      {selectedCity && (
        <div style={{ marginTop: "10px" }}>
          Выбран: <strong>{selectedCity.value}</strong> <br />
          Код ФИАС: <code>{selectedCity.fias}</code> <br />
          Регион: <code>{selectedCity.region}</code>
        </div>
      )}

      <div className="deliverySettings">
        {/* <ul>
          {Object.values(data.calculation?.sdek?.data).map((element, index) => (
              // <li key={index}>{JSON.stringify(element, null, 2)}</li>
              <li key={index}>{element.address}</li>
            )
          )}
        </ul> */}
        <pre>{JSON.stringify(data.calculation.sdek, null, 2)}</pre>
        <pre>{JSON.stringify(data.calculation.yandex, null, 2)}</pre>

      </div>
    </div>
  );
};

export default EShopLogistic;
