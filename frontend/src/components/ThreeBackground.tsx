import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function MouseCamera() {
  const { camera } = useThree()
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useFrame(() => {
    camera.position.x += (mouse.current.x * 1.5 - camera.position.x) * 0.02
    camera.position.y += (mouse.current.y * 0.8 - camera.position.y) * 0.02
    camera.lookAt(0, 0, 0)
  })

  return null
}

function WireframeGlobe() {
  const meshRef = useRef<THREE.Mesh>(null)
  const edgesRef = useRef<THREE.LineSegments>(null)

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(2.2, 2), [])
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry])

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.05
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.03) * 0.1
    }
    if (edgesRef.current) {
      edgesRef.current.rotation.y = state.clock.elapsedTime * 0.05
      edgesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.03) * 0.1
    }
  })

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry}>
        <meshBasicMaterial color="#E5E5E5" wireframe transparent opacity={0.02} />
      </mesh>
      <lineSegments ref={edgesRef} geometry={edges}>
        <lineBasicMaterial color="#E5E5E5" transparent opacity={0.06} />
      </lineSegments>
    </group>
  )
}

function InnerGlobe() {
  const meshRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1.6, 1), [])

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = -state.clock.elapsedTime * 0.08
      meshRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.02) * 0.15
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial color="#E5E5E5" wireframe transparent opacity={0.03} />
    </mesh>
  )
}

function FloatingParticles() {
  const pointsRef = useRef<THREE.Points>(null)
  const count = 800

  const [positions, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const sz = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16
      sz[i] = Math.random() * 2 + 0.5
    }
    return [pos, sz]
  }, [])

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.015
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#E5E5E5"
        size={0.015}
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

function ConnectionLines() {
  const linesRef = useRef<THREE.LineSegments>(null)
  const count = 200

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 6)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  useFrame((state) => {
    if (!linesRef.current) return
    const posAttr = linesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array
    const t = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      const i6 = i * 6
      const angle1 = (i / count) * Math.PI * 2 + t * 0.1
      const angle2 = angle1 + 0.3
      const radius = 2.5 + Math.sin(t * 0.2 + i) * 0.5
      const y1 = Math.sin(t * 0.15 + i * 0.5) * 1.5
      const y2 = Math.sin(t * 0.15 + (i + 30) * 0.5) * 1.5

      arr[i6] = Math.cos(angle1) * radius
      arr[i6 + 1] = y1
      arr[i6 + 2] = Math.sin(angle1) * radius
      arr[i6 + 3] = Math.cos(angle2) * (radius + 0.8)
      arr[i6 + 4] = y2
      arr[i6 + 5] = Math.sin(angle2) * (radius + 0.8)
    }
    posAttr.needsUpdate = true
  })

  return (
    <lineSegments ref={linesRef} geometry={geometry}>
      <lineBasicMaterial color="#E5E5E5" transparent opacity={0.03} />
    </lineSegments>
  )
}

function OrbitalRings() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = state.clock.elapsedTime * 0.02
    }
  })

  const rings = useMemo(() => [
    { radius: 3.0, segments: 128, opacity: 0.04, rotation: [0.4, 0, 0] as [number, number, number] },
    { radius: 3.5, segments: 128, opacity: 0.025, rotation: [0.8, 0.3, 0] as [number, number, number] },
    { radius: 4.0, segments: 128, opacity: 0.015, rotation: [1.2, 0.6, 0.2] as [number, number, number] },
  ], [])

  return (
    <group ref={groupRef}>
      {rings.map((ring, i) => (
        <mesh key={i} rotation={ring.rotation}>
          <ringGeometry args={[ring.radius, ring.radius + 0.005, ring.segments]} />
          <meshBasicMaterial color="#E5E5E5" transparent opacity={ring.opacity} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

function Scene() {
  return (
    <>
      <MouseCamera />
      <WireframeGlobe />
      <InnerGlobe />
      <FloatingParticles />
      <ConnectionLines />
      <OrbitalRings />
    </>
  )
}

export function ThreeBackground() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </div>
  )
}
