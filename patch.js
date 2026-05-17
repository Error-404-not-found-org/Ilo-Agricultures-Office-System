const fs = require('fs');
const path = 'c:\\Users\\Acer\\Documents\\Ilo-AgriculturesOffice-System\\mobile\\app\\(technician)\\record-ai.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `            <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-emerald-900 text-sm mb-4">Quick Animal Registration</Text>
            <View className="gap-y-4">
               <View className="flex-row gap-3">
                  <View className="flex-1">
                     <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Animal ID / Tag</Text>
                     <TextInput
                       className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                       placeholder="Tag-001"
                       value={newAnimal.animalId}
                       onChangeText={(v) => setNewAnimal({...newAnimal, animalId: v})}
                     />
                  </View>
                  <View className="flex-1">
                     <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Species</Text>
                     <TouchableOpacity 
                         onPress={() => setShowSpeciesModal(true)}
                         className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                     >
                         <Text className="text-slate-800 font-outfit-medium">{newAnimal.species}</Text>
                         <ChevronDown size={14} color="#94a3b8" />
                     </TouchableOpacity>
                  </View>
               </View>
               <View className="flex-row gap-3">
                  <View className="flex-1">
                     <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Breed</Text>
                     <TouchableOpacity 
                         onPress={() => setShowQuickBreedModal(true)}
                         className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                     >
                         <Text className={`font-outfit-medium ${newAnimal.breed ? 'text-slate-800' : 'text-slate-400'}`}>
                             {newAnimal.breed || 'Select...'}
                         </Text>
                         <ChevronDown size={14} color="#94a3b8" />
                     </TouchableOpacity>
                  </View>
                  <View className="flex-1">
                     <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Color</Text>
                     <TextInput
                       className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                       placeholder="White"
                       value={newAnimal.color}
                       onChangeText={(v) => setNewAnimal({...newAnimal, color: v})}
                     />
                  </View>
               </View>
            </View>`;

const replacement = `            <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-emerald-900 text-sm mb-4">Quick Animal Registration</Text>
            <View className="gap-y-4">
               <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Animal ID</Text>
                    <TextInput
                      className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                      placeholder="e.g. ANM-001"
                      value={newAnimal.animalId}
                      onChangeText={(v) => setNewAnimal({...newAnimal, animalId: v})}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Ear Tag</Text>
                    <TextInput
                      className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                      placeholder="104"
                      value={newAnimal.earTag}
                      onChangeText={(v) => setNewAnimal({...newAnimal, earTag: v})}
                    />
                  </View>
               </View>
               <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Species</Text>
                    <TouchableOpacity 
                        onPress={() => setShowSpeciesModal(true)}
                        className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                    >
                        <Text className="text-slate-800 font-outfit-medium">{newAnimal.species}</Text>
                        <ChevronDown size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Breed</Text>
                    <TouchableOpacity 
                        onPress={() => setShowQuickBreedModal(true)}
                        className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                    >
                        <Text className={`font-outfit-medium ${newAnimal.breed ? 'text-slate-800' : 'text-slate-400'}`}>
                            {newAnimal.breed || 'Select...'}
                        </Text>
                        <ChevronDown size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
               </View>
               <View>
                  <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Color</Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                    placeholder="White"
                    value={newAnimal.color}
                    onChangeText={(v) => setNewAnimal({...newAnimal, color: v})}
                  />
               </View>
            </View>`;

// Normalize newlines for robust matching
const clean = str => str.replace(/\r\n/g, '\n').trim();

if (clean(content).includes(clean(target))) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log("SUCCESS");
} else {
  // Try relaxed line-by-line replace
  console.log("TARGET NOT FOUND DIRECTLY, TRYING REGEX");
  const targetRegex = /Quick Animal Registration[\s\S]*?<\/View>\s*<\/View>\s*<\/View>/;
  content = content.replace(targetRegex, (match) => {
    return replacement.replace("Quick Animal Registration", "Quick Animal Registration");
  });
  fs.writeFileSync(path, content, 'utf8');
  console.log("SUCCESS REGEX");
}
