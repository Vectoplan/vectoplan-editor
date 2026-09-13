import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type CrownForm = "broadleaf" | "conifer" | "columnar";

/** Shared organic crowns: indexed triangles, smooth lighting, no leaf objects
 * or transparent overdraw. Surveyed diameter/height are applied per instance.
 */
export function createTreeCrownGeometry(form: CrownForm): THREE.BufferGeometry {
  // Broadleaf crowns have five overlapping branch clusters in one indexed
  // geometry (240 vertices), avoiding both a balloon silhouette and leaf cards.
  const clusters=form==='broadleaf' ? [
    [0,.12,0,.37],[-.23,-.10,.04,.28],[.24,-.08,-.03,.29],
    [.02,-.17,.24,.28],[-.04,-.06,-.24,.28],
  ].map(([x,y,z,r])=>new THREE.SphereGeometry(r,7,5).translate(x!,y!,z!)) : [];
  const geometry=clusters.length ? mergeGeometries(clusters,false)! : new THREE.SphereGeometry(.5,12,10);
  clusters.forEach(cluster=>cluster.dispose());
  geometry.computeBoundingBox();
  const initial=geometry.boundingBox!,centre=new THREE.Vector3();initial.getCenter(centre);
  const initialHeight=initial.max.y-initial.min.y;
  geometry.translate(-centre.x,-centre.y,-centre.z);geometry.scale(1,1/initialHeight,1);
  const position=geometry.getAttribute("position"),colors=[];
  const color=new THREE.Color();
  for(let i=0;i<position.count;i++) {
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const azimuth=Math.atan2(z,x),vertical=y+.5;
    let radius=1+.10*Math.sin(azimuth*5+vertical*6)+.045*Math.cos(azimuth*9-vertical*11);
    if(form==='conifer') radius*=Math.max(.1,1.4-vertical*1.1)*(1+.16*Math.sin(vertical*32));
    if(form==='columnar') radius*=.78+.18*Math.sin(vertical*Math.PI);
    position.setXYZ(i,x*radius,y,z*radius);
    const light=.68+vertical*.28+.10*Math.sin(azimuth*7+vertical*15);
    color.setRGB(light*.9,light,light*.78);colors.push(color.r,color.g,color.b);
  }
  geometry.computeBoundingBox();
  const box=geometry.boundingBox!,span=Math.max(box.max.x-box.min.x,box.max.z-box.min.z);
  geometry.scale(1/span,1,1/span);
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

export function createTreeTrunkGeometry(): THREE.BufferGeometry {
  const trunk=new THREE.CylinderGeometry(.28,.5,1,6);
  const branches=[-.7,.75].map((angle,index)=>{
    const branch=new THREE.CylinderGeometry(.07,.2,.46,5);
    branch.rotateZ(angle);branch.rotateY(index*1.8);branch.translate(Math.sin(-angle)*.13,.27,index?.07:0);
    return branch;
  });
  const merged=mergeGeometries([trunk,...branches],false)!;
  trunk.dispose();branches.forEach(g=>g.dispose());
  return merged;
}
