// Retired: manual account approval never changes email verification.
export async function POST(){return Response.json({error:'Chức năng xác minh email thủ công đã được thu hồi.'},{status:410,headers:{'Cache-Control':'no-store'}});}
