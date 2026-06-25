/*
  pin_mesh_factory.js
  Converted from the uploaded red/gray 3D pin HTML files into reusable Three.js Mesh helpers.

  Usage:
    // THREE must already be loaded.
    const pinFactory = createPinMeshFactory(THREE);

    const redPin = pinFactory.createRedPin({ name: '서울', scale: 0.035 });
    redPin.position.set(-0.18, 0.18, 0.33);
    scene.add(redPin);

    const grayPin = pinFactory.createGrayPin({ name: '완료 사업', scale: 0.035 });
    grayPin.position.set(0.2, 0.18, -0.27);
    scene.add(grayPin);
*/

function createPinMeshFactory(THREE) {
  if (!THREE) {
    throw new Error('THREE is required. Load three.js before pin_mesh_factory.js');
  }

  // Same base shape as the uploaded pin HTML files.
  // Geometry is created once and reused by all red/gray pins.
  function createSharedPinGeometry({
    depth = 0.52,
    outerR = 1.32,
    innerR = 0.48,
    headY = 0.72,
    tipY = -2.45,
    bevelSegments = 6,
    curveSegments = 48,
  } = {}) {
    const pinShape = new THREE.Shape();
    pinShape.moveTo(outerR, headY);
    pinShape.absarc(0, headY, outerR, 0, Math.PI, false);
    pinShape.lineTo(0, tipY);
    pinShape.lineTo(outerR, headY);

    const hole = new THREE.Path();
    hole.absarc(0, headY, innerR, 0, Math.PI * 2, true);
    pinShape.holes.push(hole);

    const geometry = new THREE.ExtrudeGeometry(pinShape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.055,
      bevelSegments,
      curveSegments,
    });

    geometry.center();
    // For use on a map plane where x/z represent surface position and y is height.
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();

    return geometry;
  }

  const sharedGeometry = createSharedPinGeometry();

  // Materials copied conceptually from the uploaded files:
  // red: 0xE03428, roughness 0.2, metalness 0.4
  // gray: 0x808080, roughness 0.75, metalness 0
  const redMaterial = new THREE.MeshStandardMaterial({
    color: 0xE03428,
    roughness: 0.2,
    metalness: 0.4,
  });

  const grayMaterial = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.75,
    metalness: 0,
  });

  function createPin({
    color = null,
    material = null,
    scale = 0.035,
    name = '',
    data = {},
    castShadow = true,
    receiveShadow = true,
  } = {}) {
    const group = new THREE.Group();

    let mat = material;
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: color ?? 0xE03428,
        roughness: 0.35,
        metalness: 0.15,
      });
    }

    const mesh = new THREE.Mesh(sharedGeometry, mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    group.add(mesh);
    group.scale.setScalar(scale);

    group.userData = {
      type: 'project-pin',
      name,
      ...data,
    };

    // Store parent group reference for Raycaster click handling.
    mesh.userData.parentPin = group;

    return group;
  }

  function createRedPin(options = {}) {
    return createPin({
      ...options,
      material: options.material || redMaterial,
    });
  }

  function createGrayPin(options = {}) {
    return createPin({
      ...options,
      material: options.material || grayMaterial,
    });
  }

  function dispose() {
    sharedGeometry.dispose();
    redMaterial.dispose();
    grayMaterial.dispose();
  }

  return {
    createPin,
    createRedPin,
    createGrayPin,
    sharedGeometry,
    redMaterial,
    grayMaterial,
    dispose,
  };
}

// Browser global fallback for non-module usage.
if (typeof window !== 'undefined') {
  window.createPinMeshFactory = createPinMeshFactory;
}

// CommonJS fallback for build tools.
if (typeof module !== 'undefined') {
  module.exports = { createPinMeshFactory };
}
