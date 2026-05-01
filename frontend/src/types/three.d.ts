declare module "three" {
  class BaseObject {
    [key: string]: any;
    constructor(...args: any[]);
  }

  interface THREEStatic {
    [key: string]: any;
  }

  namespace THREE {
    class Object3D extends BaseObject {}
    class Scene extends Object3D {}
    class Group extends Object3D {}
    class Mesh extends Object3D {}
    class Line extends Object3D {}
    class LineSegments extends Object3D {}
    class Points extends Object3D {}
    class PerspectiveCamera extends Object3D {}
    class OrthographicCamera extends Object3D {}
    class WebGLRenderer extends BaseObject {}
    class Raycaster extends BaseObject {}
    class Vector2 extends BaseObject {
      x: number;
      y: number;
    }
    class Vector3 extends BaseObject {
      x: number;
      y: number;
      z: number;
      copy(vector: Vector3): this;
      clone(): Vector3;
      set(x: number, y: number, z: number): this;
    }
    class Euler extends BaseObject {}
    class Quaternion extends BaseObject {}
    class Matrix4 extends BaseObject {}
    class Color extends BaseObject {}
    class Box3 extends BaseObject {}
    class Plane extends BaseObject {}
    class BufferGeometry extends BaseObject {}
    class Material extends BaseObject {}
    class MeshBasicMaterial extends Material {}
    class MeshStandardMaterial extends Material {}
    class LineBasicMaterial extends Material {}
    class ShaderMaterial extends Material {}
    class BufferAttribute extends BaseObject {}
    class Float32BufferAttribute extends BaseObject {}
    class Texture extends BaseObject {}
    class WebGLRenderTarget extends BaseObject {}
    class AxesHelper extends Object3D {}
    class ArrowHelper extends Object3D {}
    class GridHelper extends Object3D {}
    class AmbientLight extends Object3D {}
    class DirectionalLight extends Object3D {}
    class HemisphereLight extends Object3D {}
    class SpotLight extends Object3D {}
    class CylinderGeometry extends BufferGeometry {}
    class BoxGeometry extends BufferGeometry {}
    class SphereGeometry extends BufferGeometry {}
    class PlaneGeometry extends BufferGeometry {}
    class CircleGeometry extends BufferGeometry {}
    class EdgesGeometry extends BufferGeometry {}
    class InstancedMesh extends Mesh {}
    class Shape extends BaseObject {}
    class Path extends BaseObject {}
  }

  const THREE: THREEStatic & typeof THREE;
  export = THREE;
}

declare module "three/examples/jsm/controls/OrbitControls.js" {
  export class OrbitControls {
    constructor(...args: any[]);
    [key: string]: any;
  }
}
