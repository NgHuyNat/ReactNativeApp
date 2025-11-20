import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  TextInput,
  Keyboard,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

// THAY THẾ BẰNG API KEY CỦA BẠN TỪ OPENROUTESERVICE (Miễn phí, không cần thẻ)
const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjM0OTE5NjQ1ZmRhMDRlMTE5ZTZkZjM1M2MxMDYxZThhIiwiaCI6Im11cm11cjY0In0=";

const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export default function App() {
  const [location, setLocation] = useState(null);
  const [deliveryPoints, setDeliveryPoints] = useState([]);
  const [destination, setDestination] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [isTracking, setIsTracking] = useState(true);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Quyền truy cập bị từ chối",
          "Vui lòng cấp quyền vị trí để sử dụng ứng dụng."
        );
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation.coords);

      // Bắt đầu theo dõi vị trí nếu chế độ tracking bật
      startLocationTracking();
    })();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const handleLongPress = (event) => {
    const { coordinate } = event.nativeEvent;
    const newPoint = {
      id: Date.now(),
      title: "Vị trí đã chọn",
      description: `${coordinate.latitude.toFixed(
        5
      )}, ${coordinate.longitude.toFixed(5)}`,
      coordinate: coordinate,
    };

    setDeliveryPoints((prev) => [...prev, newPoint]);
    onMarkerPress(newPoint);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();

    try {
      const response = await fetch(
        `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(
          searchQuery
        )}&boundary.country=VN`
      );
      const result = await response.json();

      if (result.features && result.features.length > 0) {
        const coords = result.features[0].geometry.coordinates; // [lon, lat]
        const newPoint = {
          id: Date.now(),
          title: result.features[0].properties.name || searchQuery,
          description: result.features[0].properties.label,
          coordinate: {
            latitude: coords[1],
            longitude: coords[0],
          },
        };

        setDeliveryPoints((prev) => [...prev, newPoint]);
        onMarkerPress(newPoint);

        mapRef.current?.animateToRegion({
          latitude: coords[1],
          longitude: coords[0],
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else {
        Alert.alert("Không tìm thấy", "Không tìm thấy địa điểm này.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Lỗi khi tìm kiếm địa điểm.");
    }
  };

  useEffect(() => {
    if (isTracking && location) {
      animateToLocation(location);
    }
  }, [location, isTracking]);

  const startLocationTracking = async () => {
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (newLocation) => {
        setLocation(newLocation.coords);
        if (destination) {
        }
      }
    );
  };

  const animateToLocation = (coords) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  };

  const onMarkerPress = (point) => {
    setDestination(point);
    setIsTracking(false); // Tắt tracking để người dùng có thể xem toàn bộ đường đi
    fetchDirections(location, point.coordinate);
  };

  const fetchDirections = async (startLoc, endLoc) => {
    if (!startLoc || !endLoc) return;

    try {
      // Sử dụng OpenRouteService (ORS) thay vì Google Maps
      // Lưu ý: ORS dùng thứ tự [longitude, latitude]
      const response = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${startLoc.longitude},${startLoc.latitude}&end=${endLoc.longitude},${endLoc.latitude}`
      );
      const result = await response.json();

      if (result.features && result.features.length > 0) {
        const feature = result.features[0];
        const coordinates = feature.geometry.coordinates; // Mảng [[lon, lat], [lon, lat], ...]

        // Convert sang format của react-native-maps: [{latitude, longitude}]
        const points = coordinates.map((coord) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));

        setRouteCoordinates(points);

        // Lấy thông tin khoảng cách và thời gian
        const props = feature.properties;
        const distanceKm = (props.summary.distance / 1000).toFixed(1) + " km";
        const durationMins = Math.round(props.summary.duration / 60) + " phút";

        setDistance(distanceKm);
        setDuration(durationMins);

        // Zoom fit
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(points, {
            edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
            animated: true,
          });
        }
      } else {
        Alert.alert("Lỗi", "Không tìm thấy đường đi.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể kết nối đến OpenRouteService API.");
    }
  };

  const toggleTracking = () => {
    setIsTracking(!isTracking);
    if (!isTracking && location) {
      animateToLocation(location);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false} // Tắt nút mặc định để dùng nút custom
          onLongPress={handleLongPress}
        >
          {deliveryPoints.map((point) => (
            <Marker
              key={point.id}
              coordinate={point.coordinate}
              title={point.title}
              description={point.description}
              onPress={() => onMarkerPress(point)}
              pinColor="red"
            />
          ))}

          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeWidth={4}
              strokeColor="#4285F4"
            />
          )}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={{ marginTop: 10 }}>Đang lấy vị trí...</Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm địa điểm..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* UI Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.button, isTracking && styles.buttonActive]}
          onPress={toggleTracking}
        >
          <Ionicons
            name="navigate"
            size={24}
            color={isTracking ? "#fff" : "#333"}
          />
        </TouchableOpacity>
      </View>

      {/* Info Panel */}
      {destination && (
        <View style={styles.infoPanel}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoTitle}>{destination.title}</Text>
            <TouchableOpacity
              onPress={() => {
                setDestination(null);
                setRouteCoordinates([]);
                setDistance(null);
                setDuration(null);
              }}
            >
              <Ionicons name="close-circle" size={24} color="#888" />
            </TouchableOpacity>
          </View>
          <Text style={styles.infoAddress}>{destination.description}</Text>
          {distance && duration && (
            <View style={styles.routeInfo}>
              <View style={styles.routeItem}>
                <Ionicons name="time-outline" size={16} color="#4285F4" />
                <Text style={styles.routeText}>{duration}</Text>
              </View>
              <View style={styles.routeItem}>
                <Ionicons name="resize-outline" size={16} color="#4285F4" />
                <Text style={styles.routeText}>{distance}</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 25,
    paddingHorizontal: 20,
    height: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginRight: 10,
  },
  searchButton: {
    width: 50,
    height: 50,
    backgroundColor: "#4285F4",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  controlsContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 110 : 100, // Dời xuống dưới thanh tìm kiếm
    right: 20,
    flexDirection: "column",
  },
  button: {
    width: 50,
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 10,
  },
  buttonActive: {
    backgroundColor: "#4285F4",
  },
  infoPanel: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  infoAddress: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
  },
  routeInfo: {
    flexDirection: "row",
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 10,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  routeText: {
    marginLeft: 5,
    fontWeight: "600",
    color: "#333",
  },
});
