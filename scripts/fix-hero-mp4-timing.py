"""Repair a zero-duration final MP4 sample. Encoded mdat bytes are never changed."""
import hashlib, json, shutil, struct, sys
from pathlib import Path
source, target = map(Path, sys.argv[1:3])
if source.resolve() == target.resolve() or target.exists():
    raise SystemExit('Use a new output path; the original must remain unchanged.')
def atoms(f, start, end):
    pos = start
    while pos + 8 <= end:
        f.seek(pos); size, kind = struct.unpack('>I4s', f.read(8)); header = 8
        if size == 1: size = struct.unpack('>Q', f.read(8))[0]; header = 16
        if size == 0: size = end-pos
        if size < header or pos+size > end: raise ValueError('Invalid MP4 atom')
        yield kind.decode(), pos+header, pos+size
        pos += size

def digest_region(path, start, end):
    result = hashlib.sha256()
    with path.open('rb') as f:
        f.seek(start); remaining=end-start
        while remaining:
            data=f.read(min(1024*1024, remaining)); result.update(data); remaining-=len(data)
    return result.hexdigest()
patches=[]
with source.open('rb') as f:
    top=list(atoms(f,0,source.stat().st_size)); moov=next(a for a in top if a[0]=='moov'); mdat=next(a for a in top if a[0]=='mdat')
    movie=next(a for a in atoms(f,moov[1],moov[2]) if a[0]=='mvhd'); f.seek(movie[1]); d=f.read(32); movie_scale=struct.unpack_from('>I',d,12 if d[0]==0 else 20)[0]
    for _,a,b in [x for x in atoms(f,moov[1],moov[2]) if x[0]=='trak']:
        found={}
        def walk(a,b):
            for t,x,y in atoms(f,a,b):
                if t in ('mdia','minf','stbl','edts'): walk(x,y)
                else: found[t]=(x,y)
        walk(a,b); f.seek(found['hdlr'][0]+8)
        if f.read(4)!=b'vide': continue
        stts=found['stts'][0]; f.seek(stts+4); count=struct.unpack('>I',f.read(4))[0]; entries=[struct.unpack('>II',f.read(8)) for _ in range(count)]
        if entries[-1]!=(1,0): raise ValueError('Expected exactly one zero-duration final video sample')
        normal=max((duration for _,duration in entries if duration>0)); total=sum(n*duration for n,duration in entries)+normal
        patches.append((stts+8+(count-1)*8+4,struct.pack('>I',normal),'last sample duration'))
        mdhd=found['mdhd'][0]; f.seek(mdhd); d=f.read(32); version=d[0]; scale=struct.unpack_from('>I',d,12 if version==0 else 20)[0]
        patches.append((mdhd+(16 if version==0 else 24),struct.pack('>I' if version==0 else '>Q',total),'video media duration'))
        movie_duration=round(total/scale*movie_scale)
        tkhd=found['tkhd'][0]; f.seek(tkhd); version=f.read(1)[0]
        patches.append((tkhd+(20 if version==0 else 28),struct.pack('>I' if version==0 else '>Q',movie_duration),'video track duration'))
        elst=found['elst'][0]; f.seek(elst); d=f.read(28)
        if d[0]!=0 or struct.unpack_from('>I',d,4)[0]!=1 or struct.unpack_from('>i',d,12)[0]!=0: raise ValueError('Unsupported edit list')
        patches.append((elst+8,struct.pack('>I',movie_duration),'video edit duration'))
if len(patches)!=4: raise ValueError('Expected one video track')
temporary=target.with_suffix(target.suffix+'.tmp'); target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(source,temporary)
with temporary.open('r+b') as f:
    for offset, data, _ in patches: f.seek(offset); f.write(data)
before=digest_region(source,mdat[1],mdat[2]); after=digest_region(temporary,mdat[1],mdat[2])
if before!=after: temporary.unlink(); raise ValueError('Encoded data changed')
temporary.replace(target)
print(json.dumps({'source':str(source),'output':str(target),'encoded_mdat_sha256':before,'encoded_bytes_identical':True,'patched_fields':[label for _,_,label in patches],'video_duration':total/scale},ensure_ascii=False))
