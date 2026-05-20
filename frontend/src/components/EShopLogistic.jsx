import { useState, useEffect, Fragment, useRef } from "react";
import ReactDadataBox from "react-dadata-box";
import "./EShopLogistic.css";

const DEFAULT_MAP_LOCATION = {
  center: [37.588144, 55.733842],
  zoom: 9,
};

const INITIAL_STATUS = {
  code: "initial-loading",
  type: "info",
  text: "Загружаем варианты доставки...",
  reloadRecommended: false,
};

const EShopLogistic = ({ DADATA_TOKEN, ESHOPLOGISTIC_TOKEN, YANDEX_API_KEY, onDeliveryConfirm }) => {
  // Основные данные API и справочники служб доставки.
  const [data, setData] = useState({});
  const [services, setServices] = useState({});

  // Состояние выбора пользователя.
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedTerminal, setSelectedTerminal] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(false);
  const [addressPickMode, setAddressPickMode] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(null);
  const [lastUserAddress, setLastUserAddress] = useState(null);
  const [deliveryComment, setDeliveryComment] = useState("");
  const [output, setOutput] = useState(null);

  // Состояние интерфейса и загрузки.
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState(INITIAL_STATUS);
  const [mapLoad, setMapLoad] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Ссылки на объекты карты, чтобы не пересоздавать их без необходимости.
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const clustererRef = useRef(null);
  const addressPickModeRef = useRef(false);
  const deliveryAddressMarkerRef = useRef(null);
  const sourceReadyRef = useRef(false);
  const lastCalculatedFiasRef = useRef(null);

  // Унифицированное отображение статусов и ошибок для пользователя.
  function showStatus(code, type, text, reloadRecommended = false) {
    setStatusMessage((prev) => {
      if (
        prev?.code === code &&
        prev?.type === type &&
        prev?.text === text &&
        prev?.reloadRecommended === reloadRecommended
      ) {
        return prev;
      }

      return { code, type, text, reloadRecommended };
    });
  }

  function showError(code, text, reloadRecommended = false) {
    showStatus(code, "error", text, reloadRecommended);
  }

  function clearStatus(codeToClear = null) {
    setStatusMessage((prev) => {
      if (!prev) {
        return prev;
      }

      if (codeToClear && prev.code !== codeToClear) {
        return prev;
      }

      return null;
    });
  }

  // Безопасно преобразуем значение к строке для вывода в UI.
  function renderValue(value) {
    if (value == null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  // Преобразуем подсказку DaData в компактную структуру города/локации.
  function buildCityData(suggestion) {
    if (!suggestion?.data) {
      return null;
    }

    return {
      value: suggestion.value || suggestion.source,
      fias:
        suggestion.data.city_fias_id ||
        suggestion.data.settlement_fias_id ||
        suggestion.data.region_fias_id,
      lon: Number(suggestion.data.geo_lon),
      lat: Number(suggestion.data.geo_lat),
    };
  }

  // Обработчик выбора города или адреса из DaData.
  const handleCitySelect = (suggestion) => {
    const cityData = buildCityData(suggestion);

    if (!cityData) {
      setSelectedCity(null);
      return;
    }

    clearStatus("invalid-method");
    clearStatus("map-click-error");

    if (addressPickMode) {
      const nextAddress = {
        address: suggestion.value,
        lon: cityData.lon,
        lat: cityData.lat,
      };

      setDeliveryAddress(nextAddress);
      setLastUserAddress(nextAddress);

      setSelectedCity({
        ...cityData,
        value: suggestion.value || cityData.value,
      });

      showStatus("address-selected", "success", "Адрес выбран. Проверьте данные и подтвердите доставку.");
    } else {
      setSelectedCity(cityData);
      showStatus("city-selected", "info", "Город выбран. Загружаем доступные способы доставки...");
    }
  };

  // Ищем FIAS по текстовому адресу, чтобы корректно пересчитать доставку.
  async function getFiasByAddress(address) {
    try {
      const response = await fetch(
        "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address",
        {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: "Token " + DADATA_TOKEN,
          },
          body: JSON.stringify({
            query: address,
            count: 1,
          }),
        }
      );

      if (!response.ok) {
        console.error("Ошибка получения FIAS по адресу:", response.status, address);
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
          address,
      };
    } catch (requestError) {
      console.error("Ошибка получения FIAS по адресу:", requestError);
      return null;
    }
  }

  // Получаем адрес по координатам клика на карте.
  async function reverseGeocode(lon, lat) {
    const response = await fetch(
      `https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_API_KEY}&geocode=${lon},${lat}&format=json`
    );

    if (!response.ok) {
      throw new Error("Не удалось определить адрес по точке на карте.");
    }

    const geocodeData = await response.json();
    const geoObject = geocodeData.response.GeoObjectCollection.featureMember?.[0]?.GeoObject;
    const meta = geoObject?.metaDataProperty?.GeocoderMetaData;

    return {
      address: meta?.text || null,
    };
  }

  // Обрабатываем клик по карте в режиме выбора адреса курьерской доставки.
  async function handleMapClick(coords) {
    const [lon, lat] = coords;

    try {
      clearStatus("map-click-error");
      showStatus("map-click-loading", "info", "Определяем адрес по выбранной точке на карте...");

      const geocodeResult = await reverseGeocode(lon, lat);
      const address = geocodeResult?.address;

      if (!address) {
        showError(
          "map-click-error",
          "Не удалось определить адрес по выбранной точке. Попробуйте выбрать другое место."
        );
        return;
      }

      const locationData = await getFiasByAddress(address);
      const nextFias = locationData?.fias;
      const nextLocationValue = locationData?.value;

      const nextAddress = {
        address,
        lon,
        lat,
      };

      setDeliveryAddress(nextAddress);
      setLastUserAddress(nextAddress);

      setSelectedCity({
        value: nextLocationValue || address,
        fias: nextFias || selectedCity?.fias || null,
        lon,
        lat,
      });

      showStatus("address-selected", "success", "Адрес определён. Проверьте его и подтвердите доставку.");
    } catch (requestError) {
      console.error("Ошибка выбора адреса на карте:", requestError);
      showError(
        "map-click-error",
        "Не удалось получить адрес по точке на карте. Попробуйте ещё раз. Если ошибка повторяется, перезагрузите страницу.",
        true
      );
    }
  }

  // Удаляем маркер выбранного адреса курьерской доставки.
  function deleteDeliveryAddressMarker() {
    if (deliveryAddressMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeChild(deliveryAddressMarkerRef.current);
      deliveryAddressMarkerRef.current = null;
    }
  }

  // Отрисовываем маркер адреса доставки на карте.
  function renderDeliveryAddressMarker(addressData) {
    if (!mapInstanceRef.current || !window.ymaps3 || !addressData || !sourceReadyRef.current) {
      return;
    }

    const { YMapMarker } = window.ymaps3;

    deleteDeliveryAddressMarker();

    const markerElement = document.createElement("div");
    markerElement.className = "delivery-address-marker";

    deliveryAddressMarkerRef.current = new YMapMarker(
      {
        coordinates: [addressData.lon, addressData.lat],
        source: "delivery-address-source",
      },
      markerElement
    );

    mapInstanceRef.current.addChild(deliveryAddressMarkerRef.current);
  }

  // Обёртка над API EShopLogistic с сохранением ответа в общий state.
  async function customFetch(api, props = {}, saveKey = false) {
    const apiParts = api.split("/");
    const dataKey = apiParts[apiParts.length - 1];

    try {
      const response = await fetch("https://api.esplc.ru" + api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: ESHOPLOGISTIC_TOKEN, ...props }),
      });

      if (!response.ok) {
        console.error(`Ошибка ${dataKey}: ${response.status}`, props);

        if (saveKey) {
          setData((prev) => ({
            ...prev,
            [dataKey]: {
              ...prev[dataKey],
              [saveKey]: {},
            },
          }));
        }

        showError(
          `${dataKey}-error`,
          "Не удалось загрузить часть данных по доставке. Попробуйте выбрать другой способ или перезагрузить страницу.",
          true
        );

        return null;
      }

      const json = await response.json();

      if (saveKey) {
        setData((prev) => ({
          ...prev,
          [dataKey]: {
            ...prev[dataKey],
            [saveKey]: json,
          },
        }));
      } else {
        setData((prev) => ({
          ...prev,
          [dataKey]: json,
        }));
      }

      return json;
    } catch (requestError) {
      console.error(`Network error ${api}:`, requestError);

      if (saveKey) {
        setData((prev) => ({
          ...prev,
          [dataKey]: {
            ...prev[dataKey],
            [saveKey]: {},
          },
        }));
      }

      showError(
        `${dataKey}-network-error`,
        "Ошибка сети при загрузке доставки. Проверьте интернет и, если проблема не исчезнет, перезагрузите страницу.",
        true
      );

      return null;
    }
  }

  // Создаём маркер терминала для карты.
  function createMarker(feature) {
    const { YMapMarker } = window.ymaps3;
    const terminal = feature.properties.terminal;

    const markerElement = document.createElement("img");
    markerElement.className = "ymap-marker";
    markerElement.src = terminal.image;

    markerElement.onclick = (event) => {
      const terminalAddress = {
        address: terminal.address,
        lon: Number(terminal.lon),
        lat: Number(terminal.lat),
      };

      setSelectedTerminal(terminal);
      setDeliveryAddress(terminalAddress);
      clearStatus("invalid-method");
      showStatus("terminal-selected", "success", "Пункт выдачи выбран. Проверьте данные и подтвердите доставку.");

      document.querySelectorAll(".ymap-marker").forEach((target) => {
        target.classList.remove("active");
      });

      event.currentTarget.classList.add("active");
    };

    return new YMapMarker(
      {
        coordinates: feature.geometry.coordinates,
        source: "clusterer-source",
      },
      markerElement
    );
  }

  // Создаём маркер-кластер для групп близких точек.
  function createCluster(coordinates, features) {
    const { YMapMarker } = window.ymaps3;

    const clusterElement = document.createElement("div");
    clusterElement.className = "ymap-cluster";
    clusterElement.textContent = features.length;

    return new YMapMarker(
      {
        coordinates,
        source: "clusterer-source",
      },
      clusterElement
    );
  }

  // Собираем список гео-объектов терминалов для кластеризации на карте.
  function buildFeatures(calculation) {
    if (!calculation) return [];

    return Object.entries(calculation.data.terminals || {}).map(([idx, terminal]) => ({
      id: `${terminal.service}-${idx}`,
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(terminal.lon), Number(terminal.lat)],
      },
      properties: {
        terminal,
        service: terminal.service,
      },
    }));
  }

  // Переключаем тип доставки: ПВЗ или курьер.
  function changeDeliveryMethod(event, key, type) {
    document.querySelectorAll(".deliveryMethod").forEach((element) => element.classList.remove("active"));
    event.currentTarget.classList.add("active");

    const selectedAddressFromLocation =
      selectedCity && Number.isFinite(Number(selectedCity.lon)) && Number.isFinite(Number(selectedCity.lat))
        ? {
            address: selectedCity.value,
            lon: Number(selectedCity.lon),
            lat: Number(selectedCity.lat),
          }
        : null;

    const nextDoorAddress = lastUserAddress || selectedAddressFromLocation;

    switch (type) {
      case "terminal":
        setAddressPickMode(false);
        deleteDeliveryAddressMarker();
        setSelectedTerminal(null);
        showStatus("terminal-mode", "info", "Выберите удобный пункт выдачи на карте.");
        break;

      case "door":
        setAddressPickMode(true);
        setSelectedTerminal(null);

        // При возврате к курьерской доставке всегда восстанавливаем последний адрес,
        // который пользователь выбрал сам через карту или поле ввода.
        if (nextDoorAddress) {
          setDeliveryAddress(nextDoorAddress);
        }

        showStatus("door-mode", "info", "Выберите адрес на карте или введите его в строке поиска.");
        break;

      default:
        break;
    }

    setSelectedMethod({ name: key, type });
  }

  async function handleAddressSubmit() {
    if (!selectedMethod) {
      return;
    }

    let out = {};
    out.service = selectedMethod.name;
    out.type = selectedMethod.type;

    switch (selectedMethod.type) {
      case "terminal":
        
        out.isPostamat = selectedTerminal.is_postamat;
        out.address = selectedTerminal.address;
        out.code = selectedTerminal.code;
        out.price = selectedTerminal.price.value;
        out.unitPrice = selectedTerminal.price.unit;
        out.time = selectedTerminal.time.value;
        out.unitTime = selectedTerminal.time.unit;
        out.payment = selectedTerminal.payment.methods;

        break;

      case "door": {

        const recalculation = await customFetch(
          "/delivery/calculation",
          {
            to: selectedCity.fias,
            weight: 1,
            service: selectedMethod.name,
            address: deliveryAddress.address,
          },
          selectedMethod.name
        );

        if (!recalculation) {
          return;
        }

        out.address = deliveryAddress.address;
        out.price = recalculation.data.door.price.value;
        out.unitPrice = recalculation.data.door.price.unit;
        out.time = recalculation.data.door.time.value;
        out.unitTime = recalculation.data.door.time.unit;

        break;
      }

      default:
        break;
    }
    setOutput(out);

    showStatus("delivery-confirmed", "success", "Адрес доставки подтверждён.");
  }

  // Синхронизируем ref, чтобы обработчик карты всегда видел актуальный режим.
  useEffect(() => {
    addressPickModeRef.current = addressPickMode;
  }, [addressPickMode]);

  // Когда выбран адрес курьерской доставки, отображаем его маркер на карте.
  useEffect(() => {
    if (!mapReady || !deliveryAddress || !addressPickMode) {
      return;
    }

    const lon = Number(deliveryAddress.lon);
    const lat = Number(deliveryAddress.lat);

    if (mapInstanceRef.current && Number.isFinite(lon) && Number.isFinite(lat)) {
      mapInstanceRef.current.setLocation({
        center: [lon, lat],
      });
    }

    renderDeliveryAddressMarker(deliveryAddress);
  }, [deliveryAddress, mapReady, addressPickMode]);

  // Загружаем базовые данные: состояние EShopLogistic и примерный город по IP.
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        clearStatus();
        showStatus("initial-loading", "info", "Загружаем варианты доставки...");

        await customFetch("/client/state");

        const ipResponse = await fetch("https://api.ipify.org?format=json");
        if (!ipResponse.ok) {
          throw new Error("Не удалось определить IP адрес.");
        }

        const ipData = await ipResponse.json();

        const locationResponse = await fetch(
          "https://suggestions.dadata.ru/suggestions/api/4_1/rs/iplocate/address",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: "Token " + DADATA_TOKEN,
            },
            body: JSON.stringify({ ip: ipData.ip }),
          }
        );

        if (!locationResponse.ok) {
          throw new Error("Не удалось определить город автоматически.");
        }

        const locationData = await locationResponse.json();
        handleCitySelect(locationData.location);
      } catch (requestError) {
        console.error("Ошибка начальной загрузки:", requestError);
        showError(
          "initial-load-error",
          "Не удалось полностью загрузить данные доставки. Вы можете попробовать выбрать город вручную. Если ошибка повторяется, перезагрузите страницу.",
          true
        );
      }
    };

    loadInitialData();
  }, []);

  // После загрузки state сохраняем справочник служб доставки.
  useEffect(() => {
    if (data.state) {
      setServices(data.state.data.services);
    }
  }, [data.state]);

  // Когда выбран город и известны службы, запрашиваем расчёт доставки по каждой службе.
  useEffect(() => {
    if (!selectedCity?.fias || !selectedCity?.value || !Object.keys(services).length) {
      return;
    }

    if (lastCalculatedFiasRef.current !== selectedCity.fias) {
      lastCalculatedFiasRef.current = selectedCity.fias;
      showStatus("calculation-loading", "info", "Рассчитываем стоимость и сроки доставки...");

      Object.keys(services).forEach((service) => {
        customFetch(
          "/delivery/calculation",
          { to: selectedCity.fias, weight: 1, service, address: selectedCity.value },
          service
        );
      });
    }
  }, [selectedCity, services]);

  // Если после пересчёта выбранный сервис или его тип доставки недоступен,
  // сбрасываем текущий выбор, чтобы интерфейс не оставался в невалидном состоянии.
  useEffect(() => {
    if (!selectedMethod || !data.calculation) {
      return;
    }

    const selectedCalculation = data.calculation[selectedMethod.name];
    const isSelectedMethodAvailable =
      selectedMethod.type === "terminal"
        ? Boolean(selectedCalculation?.data?.terminal)
        : Boolean(selectedCalculation?.data?.door);

    if (isSelectedMethodAvailable) {
      return;
    }

    document.querySelectorAll(".deliveryMethod").forEach((element) => element.classList.remove("active"));

    setSelectedMethod(false);
    setSelectedTerminal(null);

    if (!addressPickMode) {
      deleteDeliveryAddressMarker();
    }

    showStatus(
      "invalid-method",
      "info",
      "Выбранный способ доставки больше недоступен для текущего адреса. Пожалуйста, выберите другой вариант."
    );
  }, [data.calculation, selectedMethod, addressPickMode]);

  // Центрируем карту на выбранном городе.
  useEffect(() => {
    if (!mapLoad || !mapInstanceRef.current || !selectedCity) {
      return;
    }

    const lon = Number(selectedCity.lon);
    const lat = Number(selectedCity.lat);

    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return;
    }

    if (mapLoad && data.state) {
      mapInstanceRef.current.setLocation({
        center: [lon, lat],
      });
    }
  }, [selectedCity, mapLoad, data.state]);

  // В зависимости от способа доставки либо показываем кластеры ПВЗ, либо очищаем их.
  useEffect(() => {
    if (!mapLoad || !mapReady || !data.calculation || !mapInstanceRef.current || !window.ymaps3 || !selectedMethod) {
      return;
    }

    const initClusterer = async () => {
      setSelectedTerminal(null);

      const { YMapClusterer, clusterByGrid } = await window.ymaps3.import(
        "@yandex/ymaps3-clusterer@0.0.1"
      );

      const calculation = data.calculation[selectedMethod.name];
      if (!calculation?.data?.terminals) {
        showStatus(
          "terminal-points-missing",
          "info",
          "Для выбранного способа нет точек выдачи. Попробуйте другой вариант доставки."
        );
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
        cluster: createCluster,
      });

      mapInstanceRef.current.addChild(clustererRef.current);
    };

    const initPointer = async () => {
      setSelectedTerminal(null);

      if (clustererRef.current) {
        mapInstanceRef.current.removeChild(clustererRef.current);
        clustererRef.current = null;
      }
    };

    if (selectedMethod.type === "terminal") {
      initClusterer();
    }

    if (selectedMethod.type === "door") {
      initPointer();
    }
  }, [mapLoad, mapReady, selectedMethod, data.calculation]);

  // Убираем общий loader после загрузки базового состояния модуля доставки.
  useEffect(() => {
    if (data.state) {
      setLoading(false);

      showStatus("state-loaded", "success", "Данные доставки загружены. Выберите подходящий способ.");
    }
  }, [data.state]);

  // Подключаем и инициализируем Яндекс.Карты после загрузки основных данных.
  useEffect(() => {
    if (loading) {
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

        const existingScript = document.querySelector('script[src^="https://api-maps.yandex.ru/v3/"]');

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
        showStatus("map-loading", "info", "Загружаем карту...");

        await loadYandexMapsScript();
        await window.ymaps3.ready;

        ymaps3.import.registerCdn(
          "https://cdn.jsdelivr.net/npm/{package}",
          "@yandex/ymaps3-default-ui-theme@latest"
        );

        if (cancelled || !mapRef.current) {
          return;
        }

        const {
          YMap,
          YMapDefaultSchemeLayer,
          YMapDefaultFeaturesLayer,
          YMapFeatureDataSource,
          YMapLayer,
          YMapListener,
        } = window.ymaps3;
        const { YMapControls } = window.ymaps3;
        const { YMapZoomControl } = await window.ymaps3.import("@yandex/ymaps3-default-ui-theme");

        mapInstanceRef.current = new YMap(mapRef.current, {
          location: DEFAULT_MAP_LOCATION,
        });

        const controls = new YMapControls(
          { position: "right", orientation: "vertical" },
          [new YMapZoomControl({ easing: "linear" })]
        );

        const mapListener = new YMapListener({
          layer: "any",
          onClick: (object, event) => {
            if (!addressPickModeRef.current) return;
            handleMapClick(event.coordinates);
          },
        });

        mapInstanceRef.current
          .addChild(new YMapDefaultSchemeLayer())
          .addChild(new YMapDefaultFeaturesLayer())
          .addChild(new YMapFeatureDataSource({ id: "clusterer-source" }))
          .addChild(new YMapLayer({ source: "clusterer-source", type: "markers", zIndex: 1800 }))
          .addChild(new YMapFeatureDataSource({ id: "delivery-address-source" }))
          .addChild(
            new YMapLayer({ source: "delivery-address-source", type: "markers", zIndex: 1900 })
          )
          .addChild(controls)
          .addChild(mapListener);

        sourceReadyRef.current = true;
        setMapReady(true);
        setMapLoad(true);

        showStatus("map-ready", "success", "Карта загружена. Теперь можно выбрать способ и адрес доставки.");
      } catch (requestError) {
        console.error("Ошибка загрузки Яндекс.Карт:", requestError);
        showError(
          "map-load-error",
          "Не удалось загрузить карту. Попробуйте перезагрузить страницу. Если карта не нужна, вы всё равно можете выбрать город через поиск.",
          true
        );
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

  const hasSelectedDelivery = selectedTerminal || (addressPickMode && deliveryAddress);

  useEffect(() => {
    const finalOutput = {
      ...output,
      comment: deliveryComment,
    };

    onDeliveryConfirm(finalOutput);
  },[output]);

  return (
    <div className="EShopLogistic">
      {statusMessage?.text && (
        <div className={`deliveryStatus deliveryStatus--${statusMessage.type}`}>
          <div>{statusMessage.text}</div>
          {statusMessage.reloadRecommended && (
            <div className="deliveryStatusHint">Если проблема повторяется, попробуйте перезагрузить страницу.</div>
          )}
        </div>
      )}

      {loading && <div className="deliveryLoading">Загрузка...</div>}

      {!loading && (
        <>
          <ReactDadataBox
            token={DADATA_TOKEN}
            type="address"
            onChange={handleCitySelect}
            placeholder="Введите город / Адрес доставки..."
            query={deliveryAddress?.address || selectedCity?.value || ""}
          />

          <div className="deliveryInfo">
            <div id="ymap" ref={mapRef}></div>

            <ul className="pointInfo">
              {selectedTerminal && (
                <>
                  <li>
                    <img src={selectedTerminal.image} alt={selectedTerminal.service} />
                  </li>
                  <li>{selectedTerminal.is_postamat ? "Постамат" : "Пункт выдачи"}</li>
                  <li>{renderValue(selectedTerminal.address)}</li>
                  <li>{renderValue(selectedTerminal.workTime)}</li>
                  <li>
                    Номер: {Array.isArray(selectedTerminal.phones)
                      ? selectedTerminal.phones.join(", ")
                      : renderValue(selectedTerminal.phones)}
                  </li>
                  <q>{renderValue(selectedTerminal.note)}</q>
                  <li>Оплата: {renderValue(selectedTerminal.payment?.possible)}</li>
                  <li>
                    Методы оплаты: {Array.isArray(selectedTerminal.payment?.methods)
                      ? selectedTerminal.payment.methods.join(", ")
                      : renderValue(selectedTerminal.payment?.methods)}
                  </li>
                </>
              )}

              {!selectedTerminal && deliveryAddress && selectedMethod && services[selectedMethod.name] && (
                <>
                  <li>
                    <img src={services[selectedMethod.name].logo} alt={selectedMethod.name} />
                  </li>
                  <li>{services[selectedMethod.name].name}</li>
                  <li>{deliveryAddress.address}</li>
                </>
              )}

              {hasSelectedDelivery && (
                <div className="submitDeliveryButton" onClick={() => handleAddressSubmit()}>
                  Подтвердить адрес доставки
                </div>
              )}
            </ul>
          </div>

          {data.calculation && (
            <div className="deliverySettings">
              <ul className="deliveryCalculation">
                {Object.entries(data.calculation).map(([serviceKey, body]) => (
                  <Fragment key={serviceKey}>
                    {body?.data?.terminal && (
                      <li
                        className="deliveryMethod"
                        onClick={(event) => {
                          changeDeliveryMethod(event, serviceKey, "terminal");
                        }}
                      >
                        <span>
                          {data.state.data.services[serviceKey].name} до пункта выдачи: {body?.data?.terminal?.price?.value}{" "}
                          {body?.data?.terminal?.price?.unit} - {body?.data?.terminal?.time?.value}{" "}
                          {body?.data?.terminal?.time?.unit}
                        </span>
                      </li>
                    )}

                    {body?.data?.door && (
                      <li
                        className="deliveryMethod"
                        onClick={(event) => {
                          changeDeliveryMethod(event, serviceKey, "door");
                        }}
                      >
                        <span>
                          {data.state.data.services[serviceKey].name} курьером: {body?.data?.door?.price?.value}{" "}
                          {body?.data?.door?.price?.unit} - {body?.data?.door?.time?.value}{" "}
                          {body?.data?.door?.time?.unit}
                        </span>
                      </li>
                    )}
                  </Fragment>
                ))}
              </ul>
            </div>
          )}

          {output && (
            <div className="prooveDelivery">
              <img src={services[output.service].logo} alt={output.service} />
              <div className="heading">{output.type == 'terminal' ? (output.isPostamat == true ? 'Постамат' : 'Пункт выдачи') : 'Курьер' } {services[output.service].name}</div>
              <div className="address">{output.address}</div>

              <div className="time">{output.time + ' ' + output.unitTime}</div>
              <div className="price">{output.price + ' ' + output.unitPrice}</div>
              <textarea
                type="text"
                value={deliveryComment}
                onChange={(e) => setDeliveryComment(e.target.value)}
                placeholder="Комментарий к доставке (укажите квартиру, подъезд, особенности адреса)"
              />
              <br/>
              {/* <button className="submitDelivery" onClick={}>
                Далее
              </button> */}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EShopLogistic;
