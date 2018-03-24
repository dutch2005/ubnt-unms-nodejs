'use strict';


const EARTH_RADIUS = 6371000; // meter
const DEG_TO_RAD = Math.PI / 180.0;
const THREE_PI = Math.PI * 3;
const TWO_PI = Math.PI * 2;


const generateRandomLocationWithin = (distance, point) => {
  const randomDistance = Math.sqrt(Math.random()) * distance;

  let x = point[0] * DEG_TO_RAD;
  let y = point[1] * DEG_TO_RAD;

  const sinLat = Math.sin(x);
  const cosLat = Math.cos(x);

  const bearing = Math.random() * TWO_PI;
  const theta = randomDistance / EARTH_RADIUS;
  const sinBearing = Math.sin(bearing);
  const cosBearing = Math.cos(bearing);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  x = Math.asin((sinLat * cosTheta) + (cosLat * sinTheta * cosBearing));
  y += Math.atan2(sinBearing * sinTheta * cosLat, cosTheta - (sinLat * Math.sin(x)));
  /* normalize -PI -> +PI radians */
  y = ((y + THREE_PI) % TWO_PI) - Math.PI;

  return [x / DEG_TO_RAD, y / DEG_TO_RAD];
};


module.exports = {
  generateRandomLocationWithin,
};
