export function ledgerCheck(status:string,entries:{unit:string;amount:string}[]){
 const units=new Map<string,{unit:string;debit:bigint;credit:bigint;net:bigint}>();
 for(const e of entries){const row=units.get(e.unit)??{unit:e.unit,debit:0n,credit:0n,net:0n},amount=BigInt(e.amount);row.net+=amount;if(amount<0n)row.debit-=amount;else row.credit+=amount;units.set(e.unit,row);}
 return {state:status!=='posted'?'unposted':entries.length<2||[...units.values()].some(u=>u.net!==0n)?'review':'balanced',units:[...units.values()].map(u=>({unit:u.unit,debit:u.debit.toString(),credit:u.credit.toString(),net:u.net.toString()}))};
}
