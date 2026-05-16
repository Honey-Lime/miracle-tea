import { useContext, useState, useEffect } from "react";
import ReactDadataBox from "react-dadata-box";

const EShopLogistic = ({ DADATA_TOKEN, ESHOPLOGISTIC_TOKEN }) => {
  const [selectedCity, setSelectedCity] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
  async function customFetch(api, props = {}, callback) {
    let dataKey = api.split('/');

    const response = await fetch("https://api.esplc.ru" + api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: ESHOPLOGISTIC_TOKEN, ...props }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка: ${response.status}`);
    }

    const json = await response.json();
    setData(prev => ({
      ...prev,
      [dataKey[dataKey.length - 1]]: json
    }));
  }

  // фетчив все запросы
  useEffect(() => {
    setLoading(true);
    customFetch("/client/state");
    customFetch("/delivery/info");
  }, []);

  // фетчив все запросы
  useEffect(() => {
    // setLoading(true);
    customFetch("/service/terminals", {service: 'sdek', settlement: selectedCity?.fias});
  }, [selectedCity]);

  // получаем нужные данные
  useEffect(() => {
    if (data?.state) {
      console.log(data.state.data.services);
      
      setServices(data.state.data.services);
    }
  }, [data.state]);

  // снимаем загрузку
  useEffect(() => {
    if (data.state && data.info) {
      setLoading(false);
    }
  }, [data.state, data.info]);

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;

  return (
    <div className="EShopLogistic">

      <div className="deliverySettings">

        <select className="deliveryType" value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
          <option value="">-- Выберите сервис --</option>
          <option value="terminal">В пункт самовывоза</option>
          <option value="door">До двери</option>
        </select>

        <select className="deliveryService" value={deliveryService} onChange={(e) => setDeliveryService(e.target.value)}>
          <option value="">-- Выберите сервис --</option>
          {Object.entries(services).map(([key, service]) => (
            <option key={key} value={key}>
              {service.name}
            </option>
          ))}
        </select>

      </div>

      <ReactDadataBox
        token={DADATA_TOKEN}
        type="address"
        onChange={handleCitySelect}
        placeholder="Введите город/Точный адрес..."
      />

      {selectedCity && (
        <div style={{ marginTop: "10px" }}>
          Выбран: <strong>{selectedCity.value}</strong> <br />
          Код ФИАС: <code>{'${selectedCity.fias}'}</code> <br />
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
    </div>
  );
};

export default EShopLogistic;
