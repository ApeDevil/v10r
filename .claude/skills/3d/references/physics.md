# Physics with Rapier

Rapier is a high-performance physics engine written in Rust, compiled to WASM. Requires `@threlte/rapier` and `@dimforge/rapier3d-compat`.

## Basic Setup

```svelte
<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { World } from '@threlte/rapier';
  import Scene from './Scene.svelte';
</script>

<Canvas>
  <World gravity={[0, -9.81, 0]}>
    <Scene />
  </World>
</Canvas>
```

## Rigid Bodies

**Types:**
| Type | Behavior |
|------|----------|
| `dynamic` | Affected by forces, gravity |
| `fixed` | Immovable (ground, walls) |
| `kinematicPosition` | Moved programmatically |
| `kinematicVelocity` | Velocity-driven movement |

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { RigidBody } from '@threlte/rapier';
</script>

<!-- Dynamic (falls, bounces) -->
<RigidBody type="dynamic">
  <T.Mesh>
    <T.SphereGeometry args={[0.5]} />
    <T.MeshStandardMaterial color="red" />
  </T.Mesh>
</RigidBody>

<!-- Fixed (static ground) -->
<RigidBody type="fixed">
  <T.Mesh rotation.x={-Math.PI / 2}>
    <T.PlaneGeometry args={[20, 20]} />
    <T.MeshStandardMaterial color="#333" />
  </T.Mesh>
</RigidBody>
```

## Colliders

**AutoColliders (automatic shape detection):**
```svelte
<RigidBody>
  <AutoColliders shape="ball">
    <T.Mesh>
      <T.SphereGeometry args={[0.5]} />
      <T.MeshStandardMaterial />
    </T.Mesh>
  </AutoColliders>
</RigidBody>
```

**Shapes:**
| Shape | Use Case |
|-------|----------|
| `ball` | Spheres, round objects |
| `cuboid` | Boxes, rectangular |
| `capsule` | Characters, pills |
| `trimesh` | Complex static meshes |
| `convexHull` | Complex dynamic meshes |

**Manual colliders:**
```svelte
<RigidBody>
  <Collider shape="cuboid" args={[1, 0.5, 1]} />
  <T.Mesh>
    <T.BoxGeometry args={[2, 1, 2]} />
    <T.MeshStandardMaterial />
  </T.Mesh>
</RigidBody>
```

**Collider offset:**
```svelte
<RigidBody>
  <Collider
    shape="ball"
    args={[0.5]}
    position={[0, 1, 0]}  <!-- Offset from body -->
  />
</RigidBody>
```

## Collision Events

```svelte
<script lang="ts">
  function handleCollision(event) {
    console.log('Collided with:', event.targetRigidBody);
  }

  function handleSensorEnter(event) {
    console.log('Entered sensor zone');
  }
</script>

<RigidBody
  oncollisionenter={handleCollision}
  oncollisionexit={() => console.log('Collision ended')}
>
  <!-- ... -->
</RigidBody>

<!-- Sensor (triggers without physics response) -->
<RigidBody>
  <Collider
    shape="cuboid"
    args={[2, 2, 2]}
    sensor
    onsensorenter={handleSensorEnter}
    onsensorexit={() => console.log('Left sensor')}
  />
</RigidBody>
```

## Applying Forces

```svelte
<script lang="ts">
  import { RigidBody } from '@threlte/rapier';
  import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';

  let rigidBody: RapierRigidBody;

  function jump() {
    rigidBody.applyImpulse({ x: 0, y: 10, z: 0 }, true);
  }

  function push() {
    rigidBody.applyForce({ x: 50, y: 0, z: 0 }, true);
  }

  function spin() {
    rigidBody.applyTorqueImpulse({ x: 0, y: 5, z: 0 }, true);
  }
</script>

<RigidBody bind:rigidBody>
  <!-- ... -->
</RigidBody>

<button onclick={jump}>Jump</button>
```

**Force methods:**
| Method | Effect | Duration |
|--------|--------|----------|
| `applyForce` | Continuous push | Per frame |
| `applyImpulse` | Instant push | One-time |
| `applyTorque` | Continuous rotation | Per frame |
| `applyTorqueImpulse` | Instant rotation | One-time |

## Kinematic Bodies

**Position-based (teleport-like):**
```svelte
<script lang="ts">
  import { useTask } from '@threlte/core';
  import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';

  let rigidBody: RapierRigidBody;
  let time = 0;

  useTask((delta) => {
    time += delta;
    rigidBody?.setNextKinematicTranslation({
      x: Math.sin(time) * 3,
      y: 1,
      z: 0
    });
  });
</script>

<RigidBody type="kinematicPosition" bind:rigidBody>
  <AutoColliders shape="cuboid">
    <T.Mesh>
      <T.BoxGeometry />
      <T.MeshStandardMaterial color="blue" />
    </T.Mesh>
  </AutoColliders>
</RigidBody>
```

**Velocity-based (smooth):**
```svelte
<RigidBody type="kinematicVelocity" bind:rigidBody>
  <!-- Set velocity instead of position -->
</RigidBody>

<script>
  rigidBody.setLinvel({ x: 5, y: 0, z: 0 }, true);
</script>
```

## Character Controller

```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { RigidBody, Collider, useRapier } from '@threlte/rapier';
  import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';

  let rigidBody: RapierRigidBody;
  let grounded = false;
  const speed = 5;
  const jumpForce = 8;

  // Keyboard state
  let keys = { w: false, a: false, s: false, d: false, space: false };

  useTask((delta) => {
    if (!rigidBody) return;

    const velocity = rigidBody.linvel();
    let x = 0, z = 0;

    if (keys.w) z -= speed;
    if (keys.s) z += speed;
    if (keys.a) x -= speed;
    if (keys.d) x += speed;

    rigidBody.setLinvel({ x, y: velocity.y, z }, true);

    if (keys.space && grounded) {
      rigidBody.applyImpulse({ x: 0, y: jumpForce, z: 0 }, true);
      grounded = false;
    }
  });
</script>

<svelte:window
  onkeydown={(e) => keys[e.key.toLowerCase()] = true}
  onkeyup={(e) => keys[e.key.toLowerCase()] = false}
/>

<RigidBody
  bind:rigidBody
  lockRotations
  oncollisionenter={() => grounded = true}
>
  <Collider shape="capsule" args={[0.5, 0.3]} />
  <T.Mesh>
    <T.CapsuleGeometry args={[0.3, 1]} />
    <T.MeshStandardMaterial color="green" />
  </T.Mesh>
</RigidBody>
```

## Physics Properties

```svelte
<RigidBody
  mass={2}
  linearDamping={0.5}
  angularDamping={0.5}
  gravityScale={1}
  ccd={true}  <!-- Continuous collision detection for fast objects -->
>
  <Collider
    shape="ball"
    args={[0.5]}
    friction={0.5}
    restitution={0.7}  <!-- Bounciness -->
    density={1}
  />
</RigidBody>
```

## Debug Visualization

```svelte
<script lang="ts">
  import { Debug } from '@threlte/rapier';
</script>

<World>
  <Debug />  <!-- Shows collider wireframes -->
  <!-- ... -->
</World>
```

**Remove in production!**

## Deterministic Physics

For replays, networking, or consistent behavior:

```svelte
<World framerate={50}>
  <!-- Fixed 50fps = 0.02s per step, regardless of render rate -->
</World>
```

## Complex Terrain

```svelte
<script lang="ts">
  import { useGltf } from '@threlte/extras';
  import { RigidBody, AutoColliders } from '@threlte/rapier';

  const terrain = useGltf('/terrain.glb');
</script>

{#if $terrain}
  <RigidBody type="fixed">
    <AutoColliders shape="trimesh">
      <T is={$terrain.scene} />
    </AutoColliders>
  </RigidBody>
{/if}
```

**Note:** `trimesh` is expensive. Use only for static geometry.

## Joints

```svelte
<script lang="ts">
  import { RigidBody, SphericalJoint } from '@threlte/rapier';
  import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';

  let bodyA: RapierRigidBody;
  let bodyB: RapierRigidBody;
</script>

<RigidBody type="fixed" bind:rigidBody={bodyA} position={[0, 5, 0]}>
  <!-- Anchor point -->
</RigidBody>

<RigidBody bind:rigidBody={bodyB} position={[0, 3, 0]}>
  <T.Mesh>
    <T.SphereGeometry args={[0.3]} />
    <T.MeshStandardMaterial />
  </T.Mesh>
</RigidBody>

{#if bodyA && bodyB}
  <SphericalJoint
    bodyA={bodyA}
    bodyB={bodyB}
    anchorA={[0, 0, 0]}
    anchorB={[0, 2, 0]}
  />
{/if}
```

**Joint types:**
| Joint | Description |
|-------|-------------|
| `SphericalJoint` | Ball-and-socket |
| `RevoluteJoint` | Hinge (one axis) |
| `PrismaticJoint` | Slider (one axis) |
| `FixedJoint` | Rigid connection |

## Performance Tips

1. **Use simple colliders** - primitives > convexHull > trimesh
2. **Enable CCD** only for fast-moving objects
3. **Fixed framerate** for determinism
4. **Limit active bodies** - sleep inactive ones
5. **Use collision groups** to reduce checks

**Collision groups:**
```svelte
<RigidBody>
  <Collider
    shape="ball"
    args={[0.5]}
    collisionGroups={interactionGroups(
      [0],     <!-- This body's groups -->
      [0, 1]   <!-- Groups it collides with -->
    )}
  />
</RigidBody>
```
