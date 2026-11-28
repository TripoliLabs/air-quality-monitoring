import sys
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString, TCollection_AsciiString
from OCP.XCAFDoc import XCAFDoc_DocumentTool
from OCP.TDF import TDF_LabelSequence
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.RWGltf import RWGltf_CafWriter
from OCP.TColStd import TColStd_IndexedDataMapOfStringString
from OCP.Message import Message_ProgressRange
src,dst=sys.argv[1],sys.argv[2]
doc=TDocStd_Document(TCollection_ExtendedString("doc"))
r=STEPCAFControl_Reader(); r.SetColorMode(True); r.SetNameMode(True)
assert r.ReadFile(src)==1
r.Transfer(doc)
st=XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
labs=TDF_LabelSequence(); st.GetFreeShapes(labs)
for i in range(1,labs.Length()+1):
    BRepMesh_IncrementalMesh(st.GetShape_s(labs.Value(i)),0.05,False,0.3,True)
w=RWGltf_CafWriter(TCollection_AsciiString(dst),True)
w.Perform(doc,TColStd_IndexedDataMapOfStringString(),Message_ProgressRange())
print("done")
