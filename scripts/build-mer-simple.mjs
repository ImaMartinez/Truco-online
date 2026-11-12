// Native editable draw.io XML. Conceptual projection of the implemented schema.
import {mkdir,writeFile} from 'node:fs/promises';
const directory='docs/diagramas';await mkdir(directory,{recursive:true});
const escape=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cells=['<mxCell id="0"/>','<mxCell id="1" parent="0"/>'];
const entityStyle='rounded=0;whiteSpace=wrap;html=1;fillColor=#e9f2ef;strokeColor=#245345;strokeWidth=2;fontColor=#183e33;fontSize=18;align=center;verticalAlign=middle;fontFamily=Arial;';
const relationStyle='rhombus;whiteSpace=wrap;html=1;fillColor=#fff5d9;strokeColor=#a88038;strokeWidth=1.8;fontColor=#59431d;fontSize=15;fontFamily=Arial;fontStyle=1;';
const textStyle='text;html=1;whiteSpace=wrap;fillColor=none;strokeColor=none;fontFamily=Arial;fontColor=#475a52;fontSize=14;verticalAlign=middle;align=left;';
function vertex(id,value,x,y,w,h,style){cells.push(`<mxCell id="${id}" value="${escape(value)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);}
const entities=[
 ['jugador','JUGADOR','Alias · perfil humano o CPU',180,240],
 ['mazo','MAZO','Nombre · composición',660,240],
 ['carta','CARTA','Tipo del catálogo · estadísticas',1140,240],
 ['sala','SALA','Código · estado',180,740],
 ['partida','PARTIDA','Modalidad · inicio · resultado',660,740],
 ['turno','TURNO','Número · energía · plazo',1140,740],
 ['jugada','JUGADA','Orden · invocación o ataque',1140,1080]
];
for(const [id,name,note,x,y]of entities)vertex(id,`<b>${name}</b><br><span style="font-size:12px">${note}</span>`,x,y,180,84,entityStyle);
const relationships=[
 {id:'crea_mazo',name:'crea',x:440,y:248,source:'jugador',target:'mazo',a:'(0,N)',b:'(1,1)',from:[1,.5],to:[0,.5],mapping:['mazo.id_jugador']},
 {id:'contiene',name:'contiene',x:920,y:248,source:'mazo',target:'carta',a:'(0,N)',b:'(0,N)',from:[1,.5],to:[0,.5],mapping:['mazo_carta'],attribute:'cantidad incluida'},
 {id:'colecciona',name:'colecciona',x:680,y:91,source:'jugador',target:'carta',a:'(0,40)',b:'(0,N)',from:[.5,0],to:[.5,0],p1:[[270,125]],p2:[[1230,125]],r1:[0,.5],r2:[1,.5],mapping:['coleccion_jugador'],attribute:'cantidad poseída'},
 {id:'crea_sala',name:'crea',x:200,y:465,source:'jugador',target:'sala',a:'(0,N)',b:'(1,1)',from:[.5,1],to:[.5,0],r1:[.5,0],r2:[.5,1],mapping:['sala.id_anfitrion']},
 {id:'se_une',name:'se une a',x:35,y:465,source:'jugador',target:'sala',a:'(0,N)',b:'(0,1)',from:[0,.5],to:[0,.5],r1:[.5,0],r2:[.5,1],p1:[[105,282]],p2:[[105,782]],mapping:['sala.id_invitado']},
 {id:'participa',name:'participa en',x:415,y:480,source:'jugador',target:'partida',a:'(0,N)',b:'(2,2)',from:[.85,1],to:[.17,0],r1:[0,.5],r2:[1,.5],p1:[[333,440],[370,440],[370,514]],p2:[[690,514]],mapping:['participante_partida','mazo.id_jugador'],attribute:'posición · vida del héroe'},
 {id:'usa',name:'usa',x:680,y:465,source:'partida',target:'mazo',a:'(2,2)',b:'(0,N)',from:[.5,0],to:[.5,1],r1:[.5,1],r2:[.5,0],mapping:['participante_partida.id_mazo']},
 {id:'origina',name:'origina',x:440,y:748,source:'sala',target:'partida',a:'(0,1)',b:'(0,1)',from:[1,.5],to:[0,.5],mapping:['sala.id_partida']},
 {id:'organiza',name:'contiene',x:920,y:748,source:'partida',target:'turno',a:'(1,30)',b:'(1,1)',from:[1,.5],to:[0,.5],mapping:['turno.id_partida']},
 {id:'registra',name:'registra',x:1160,y:915,source:'turno',target:'jugada',a:'(0,N)',b:'(1,1)',from:[.5,1],to:[.5,0],r1:[.5,0],r2:[.5,1],mapping:['jugada.id_turno']}
];
function edge(id,source,target,label,exit,entry,points=[],attribute=false){
 const vertical=exit[0]===.5&&exit[1]!==.5;const style=`edgeStyle=none;rounded=0;html=1;startArrow=none;endArrow=none;strokeColor=#61736b;strokeWidth=${attribute?1:1.6};fontFamily=Arial;fontSize=13;fontColor=#263f34;labelBackgroundColor=#ffffff;exitX=${exit[0]};exitY=${exit[1]};exitDx=0;exitDy=0;entryX=${entry[0]};entryY=${entry[1]};entryDx=0;entryDy=0;`;
 cells.push(`<mxCell id="${id}" value="${escape(label)}" style="${style}" edge="1" parent="1" source="${source}" target="${target}"><mxGeometry x="-0.67" y="0" relative="1" as="geometry"><mxPoint x="${vertical?24:0}" y="${vertical?0:-13}" as="offset"/>${points.length?'<Array as="points">'+points.map(([x,y])=>`<mxPoint x="${x}" y="${y}"/>`).join('')+'</Array>':''}</mxGeometry></mxCell>`);
}
for(const r of relationships){vertex(r.id,r.name,r.x,r.y,140,68,relationStyle);edge(r.id+'_a',r.source,r.id,r.a,r.from,r.r1??[0,.5],r.p1);edge(r.id+'_b',r.target,r.id,r.b,r.to,r.r2??[1,.5],r.p2);}
vertex('cantidad_coleccion','cantidad poseída',680,175,140,38,'ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#94a89d;fontColor=#475a52;fontSize=12;fontFamily=Arial;');
edge('atributo_coleccion','colecciona','cantidad_coleccion','',[.5,1],[.5,0],[],true);
vertex('cantidad_mazo','cantidad incluida',920,365,140,38,'ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#94a89d;fontColor=#475a52;fontSize=12;fontFamily=Arial;');
edge('atributo_mazo','contiene','cantidad_mazo','',[.5,1],[.5,0],[],true);
vertex('datos_participacion','posición · vida del héroe',390,585,200,40,'ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#94a89d;fontColor=#475a52;fontSize=12;fontFamily=Arial;');
edge('atributo_participacion','participa','datos_participacion','',[.5,1],[.5,0],[],true);
vertex('titulo','<b>TRUCOONLINE · MER CONCEPTUAL SIMPLE</b>',180,12,1140,38,textStyle+'fontSize=25;fontColor=#183e33;');
vertex('subtitulo','Entidades principales y acciones · sin tablas intermedias · lectura conceptual del SQL vigente',180,53,1140,24,textStyle+'fontSize=13;');
vertex('reglas','<b>REGLAS DEL DOMINIO</b><br><br>• Cada partida tiene dos jugadores distintos; CPU también se representa como Jugador.<br>• Cada participante usa un mazo propio. La partida utiliza dos mazos.<br>• Un mazo listo contiene 12 o 20 cartas; máximo 2 copias por tipo.<br>• Los borradores pueden estar vacíos. El atributo «cantidad incluida» cuenta las copias.<br>• Una sala puede esperar sin partida; las partidas contra CPU no necesitan sala.<br>• La partida tiene hasta 30 turnos. Jugada representa una invocación o un ataque.',180,920,780,222,'rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f8f6;strokeColor=#c7d5cd;fontColor=#314c40;fontSize=14;align=left;verticalAlign=top;spacing=18;fontFamily=Arial;');
vertex('leyenda','<b>Cómo leerlo</b>  Rectángulo = entidad · Rombo = relación/acción · Óvalo = atributo de una relación.<br>El intervalo junto a cada entidad indica cuántas veces una instancia puede participar: (1,1) exactamente una; (0,N) ninguna o muchas; (2,2) exactamente dos.<br><br>Vista simplificada: autenticación, reintentos, reservas de mazos en sala, copias de combate y subtipos no se despliegan. No es un DER físico ni una aprobación académica.',180,1210,1140,120,textStyle+'fontSize=13;');
const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" agent="TrucoOnline" version="24.7.17" type="device" compressed="false"><diagram id="trucoonline-mer-simple" name="MER simple"><mxGraphModel dx="1500" dy="1400" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1500" pageHeight="1400" math="0" shadow="0"><root>${cells.join('\n')}</root></mxGraphModel></diagram></mxfile>\n`;
await writeFile(directory+'/TrucoOnline-MER-simple.drawio',xml);await writeFile(directory+'/TrucoOnline-MER-simple.xml',xml);
await writeFile(directory+'/TrucoOnline-MER-simple-mapeo.json',JSON.stringify({scope:'conceptual simplified; not a physical DER',entities:entities.map(([id])=>id),relationships:relationships.map(({id,name,source,target,a,b,mapping,attribute})=>({id,verb:name,source,target,sourceParticipation:a,targetParticipation:b,mapping,attribute})),omitted:['jugador_auth','auth.users','intento_recuperacion','solicitud_operacion','copia_carta_partida','invocacion','ataque','sala.id_mazo_anfitrion','sala.id_mazo_invitado'],associationsReplaced:['coleccion_jugador','mazo_carta','participante_partida']},null,2)+'\n');
console.log('Generated editable draw.io and XML: 7 entities, 10 relationships, 3 relationship attributes.');
