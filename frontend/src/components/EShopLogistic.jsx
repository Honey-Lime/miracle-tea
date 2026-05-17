import { useContext, useState, useEffect } from "react";
import ReactDadataBox from "react-dadata-box";

const EShopLogistic = ({ DADATA_TOKEN, ESHOPLOGISTIC_TOKEN }) => {
  const [ip, setIp] = useState(null);

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




  // фетчим все запросы
  useEffect(() => {

    setLoading(true);
    customFetch("/client/state");
    customFetch("/delivery/info");
    
    fetch("https://api.ipify.org?format=json")
      .then(res => res.json())
      .then(data => {
        setIp(data.ip);
      })
      .catch(err => {
        setError(err.message);
      });

  }, []);


  useEffect(() => {

    if(ip) {
      customFetch("/locality/geo", {ip: ip});
    }

  }, [ip]);


  // фетчим все запросы
  useEffect(() => {

    if (selectedCity && data.state)
    Object.keys(services).forEach((service) => {
      customFetch("/service/terminals", {service: service, settlement: selectedCity?.fias}, service);
    });

  }, [selectedCity, data.state]);


  // получаем нужные данные
  useEffect(() => {

    if (data.state) {
      console.log(data.state.data.services);
      
      setServices(data.state.data.services);
    }

  }, [data.state]);


  // получаем нужные данные
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


  // снимаем загрузку
  useEffect(() => {

    // проверяем что все подгрузилось
    if (data.state && data.info && data.terminals) {
      setLoading(false);
    }

  }, [data.state, data.info, data.terminals]);




  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;

  return (
    <div className="EShopLogistic">

      {/* <div>IP - {ip}</div>
      <div>geo - {Object.keys(data.geo.data).join(', ')}</div>
      <div>geo - {data.geo.data.name}</div> */}



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

      <ul>
        Ответ EShop
        <br/>
        {/* <b>{Object.keys(data).join(', ')}</b> */}
        {/* <pre>{services.join(', ')}</pre> */}
        {/* <pre>{JSON.stringify(data.state.data.services, null, 2)}</pre> */}
        {/* <pre>{JSON.stringify(data.state.data.services, null, 2)}</pre> */}
        {/* <pre>{JSON.stringify(data.terminals?.data, null, 2)}</pre> */}
        {/* <pre>{JSON.stringify(data.info, null, 2)}</pre> */}
      </ul>
      <div className="deliverySettings">
        <ul>
          {Object.values(data.terminals?.sdek.data).forEach((element) => {
            (
              <li>element</li>
            )
          })}
        </ul>
        <b>{Object.keys(data.terminals.sdek).join(', ')}</b>
        {/* <pre>{JSON.stringify(data.terminals.sdek.data, null, 2)}</pre> */}

        {/* <select className="deliveryType" value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
          <option value="">-- Выберите сервис --</option>
          <option value="terminal">В пункт самовывоза</option>
          <option value="door">До двери</option>
        </select> */}

        {/* <select className="deliveryService" value={deliveryService} onChange={(e) => setDeliveryService(e.target.value)}>
          <option value="">-- Выберите сервис --</option>
          {Object.entries(services).map(([key, service]) => (
            <option key={key} value={key}>
              {service.name}
            </option>
          ))}
        </select> */}

      </div>
    </div>
  );
};

export default EShopLogistic;
